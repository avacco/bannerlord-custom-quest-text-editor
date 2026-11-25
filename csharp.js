'use strict';

// Antes de que venga algún intelectual, *sí*, esto fue generado por IA. Creo que fue Opus 5.5. Ya ni me acuerdo.
// Osea, mira esta maraña, viejo. Ni aunque lo intente voy a entenderlo.

const CSharpDialogue = (() => {
  // The lexer keeps C# expressions opaque while locating calls and string literals.
  const tokenPattern = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|\$*(?<raw>"{3,})[\s\S]*?\k<raw>|\$@"|@\$\x22|\$"|@"(?:[^"]|"")*"|"(?:[^"\\\r\n]|\\[^\r\n])*"|'(?:[^'\\\r\n]|\\[^\r\n])*'|@?[\p{L}_][\p{L}\p{N}_]*|[0-9][a-zA-Z0-9_]*|=>|\?\?|\s+|./syu;
  const openers = new Map([['(', ')'], ['[', ']'], ['{', '}']]);
  const closers = new Set(openers.values());
  const flowLines = new Map([
    ['NpcLine', ['npc', false, ['npcText', 'speakerDelegate', 'listenerDelegate', 'inputToken', 'outputToken']]],
    ['PlayerLine', ['player', false, ['playerText', 'listenerDelegate', 'inputToken', 'outputToken']]],
    ['NpcOption', ['npc', true, ['text', 'conditionDelegate', 'speakerDelegate', 'listenerDelegate', 'inputToken', 'outputToken']]],
    ['PlayerOption', ['player', true, ['text', 'listenerDelegate', 'inputToken', 'outputToken']]],
  ]);
  const flowCallbacks = new Map([['Condition', 'condition'], ['Consequence', 'consequence'], ['ClickableCondition', 'clickable']]);
  const flatParams = ['id', 'inputToken', 'outputToken', 'text', 'conditionDelegate', 'consequenceDelegate', 'priority', 'clickableConditionDelegate'];
  const analysis = new WeakMap();

  function tokenAt(source, start) {
    tokenPattern.lastIndex = start;
    const value = tokenPattern.exec(source)[0];
    if (!['$"', '$@"', '@$"'].includes(value)) return value;
    const verbatim = value.includes('@');
    let i = start + value.length;
    while (i < source.length) {
      const c = source[i++];
      if (!verbatim && c === '\\') {
        i++;
      } else if (c === '"') {
        if (!verbatim || source[i] !== '"') break;
        i++;
      } else if (c === '{') {
        if (source[i] === '{') { i++; continue; }
        let depth = 1;
        while (depth && i < source.length) {
          const item = tokenAt(source, i);
          if (item === '{') depth++;
          if (item === '}') depth--;
          i += item.length;
        }
      }
    }
    return source.slice(start, i);
  }

  function lex(source) {
    const tokens = [];
    const stack = [];
    for (let start = 0; start < source.length;) {
      const value = tokenAt(source, start);
      const token = { value, start, end: start + value.length, pair: -1, enclosing: stack.at(-1) };
      start = token.end;
      if (/^(?:\s|\/\/|\/\*)/.test(value)) continue;
      if (openers.has(value)) stack.push(tokens.length);
      if (closers.has(value) && openers.get(tokens[stack.at(-1)]?.value) === value) {
        const opening = stack.pop();
        token.pair = opening;
        tokens[opening].pair = tokens.length;
      }
      tokens.push(token);
    }
    return tokens;
  }

  function ranges(tokens, first, end) {
    const result = [];
    let start = first;
    for (let i = first; i < end; i++) {
      if (tokens[i].pair > i) {
        i = tokens[i].pair;
      } else if (tokens[i].value === ',') {
        result.push([start, i]);
        start = i + 1;
      }
    }
    if (start < end) result.push([start, end]);
    return result;
  }

  function args(tokens, open, names, end = tokens[open]?.pair) {
    if (end <= open || tokens[open]?.value !== '(') throw new Error('Llamada C# incompleta.');
    const result = new Map();
    ranges(tokens, open + 1, end).forEach(([start, stop], i) => {
      const named = tokens[start + 1]?.value === ':';
      const name = named ? tokens[start].value : names[i];
      if (!names.includes(name) || result.has(name)) throw new Error('Argumento C# no reconocido.');
      result.set(name, [start + (named ? 2 : 0), stop]);
    });
    return result;
  }

  function readLiteral(value) {
    if (value.startsWith('@"')) return value.slice(2, -1).replaceAll('""', '"');
    const escapes = { '0': '\0', a: '\x07', b: '\b', e: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '"': '"', "'": "'", '\\': '\\' };
    return value.slice(1, -1).replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|x[0-9a-fA-F]{1,4}|.)/g, (_, escape) => {
      if (escape.length > 1) return String.fromCodePoint(parseInt(escape.slice(1), 16));
      if (Object.hasOwn(escapes, escape)) return escapes[escape];
      throw new Error('Secuencia de escape C# no reconocida.');
    });
  }

  function literal(tokens, range, label) {
    if (!range) throw new Error('Falta ' + label + '.');
    const [start, end] = range;
    let result = '';
    for (let i = start; i < end; i += 2) {
      const value = tokens[i].value;
      if (!/^@?"/.test(value) || /^"{3}/.test(value) || value.length < 2 || (i + 1 < end && tokens[i + 1].value !== '+')) {
        throw new Error(label + ' requiere una cadena literal o una concatenación de cadenas literales.');
      }
      result += readLiteral(value);
    }
    if (start >= end || (end - start) % 2 === 0) throw new Error('No se pudo leer ' + label + '.');
    return result;
  }

  function readCode(source, tokens, range) {
    if (!range) return '';
    const [start, end] = range;
    if (start >= end) throw new Error('Argumento vacío.');
    const code = source.slice(tokens[start].start, tokens[end - 1].end);
    return code === 'null' ? '' : code;
  }

  function expressionEnd(tokens, start) {
    let end = start;
    while (end < tokens.length && ![';', '}'].includes(tokens[end].value)) {
      end = tokens[end].pair > end ? tokens[end].pair + 1 : end + 1;
    }
    return end;
  }

  function textChain(tokens, start, end) {
    const decorators = ['SetTextVariable', 'WithCharacter', 'WithGoldIcon', 'ToString'];
    for (let i = start; i < end;) {
      const call = tokens[i + 2];
      if (tokens[i].value !== '.' || !decorators.includes(tokens[i + 1]?.value)
        || call?.value !== '(' || call.pair <= i + 2 || call.pair >= end) return false;
      i = call.pair + 1;
    }
    return true;
  }

  function textReference(tokens, range, definitionAt, depth = 0) {
    if (!range || depth > 8) return null;
    const [start, end] = range;
    if (start >= end) return null;
    if (tokens[start].value === '(' && tokens[start].pair === end - 1) {
      return textReference(tokens, [start + 1, end - 1], definitionAt, depth + 1);
    }
    if (tokens[start].value === 'new' && tokens[start + 1]?.value === 'TextObject' && tokens[start + 2]?.value === '('
      && tokens[start + 2].pair > start + 2 && tokens[start + 2].pair < end) {
      const close = tokens[start + 2].pair;
      if (!textChain(tokens, close + 1, end)) return null;
      const [raw] = ranges(tokens, start + 3, close);
      const first = raw && tokens[raw[0] + 1]?.value === ':' ? [raw[0] + 2, raw[1]] : raw;
      return textReference(tokens, first, definitionAt, depth + 1);
    }
    try {
      const text = literal(tokens, range, 'El texto');
      const match = /^\{=([^}]+)\}/.exec(text);
      return { id: match && match[1] !== '!' ? match[1] : '', fallback: match ? text.slice(match[0].length) : text };
    } catch { /* try a field, local variable, or method */ }
    let i = start;
    const names = [];
    while (i < end && /^[A-Za-z_]\w*$/.test(tokens[i].value)) {
      names.push(tokens[i++].value);
      if (tokens[i]?.value !== '.') break;
      i++;
    }
    if (!names.length) return null;
    const member = names.join('.');
    if (i === end) {
      const definition = names.length === 1 ? definitionAt?.(tokens[start].value, start) : undefined;
      return definition ? textReference(tokens, definition.range, definitionAt, depth + 1) : { member, arity: null };
    }
    if (tokens[i]?.value !== '(' || tokens[i].pair <= i || tokens[i].pair >= end) return null;
    const close = tokens[i].pair;
    if (!textChain(tokens, close + 1, end)) return null;
    const parameters = ranges(tokens, i + 1, close);
    if (member === 'GameTexts.FindText') {
      try { return { id: literal(tokens, parameters[0], 'La clave de texto'), fallback: '' }; } catch { return null; }
    }
    return { member, arity: parameters.length };
  }

  function localizationIndex(source) {
    const tokens = lex(source);
    const types = new Map();
    const entries = [];
    for (let i = 0; i < tokens.length; i++) {
      if (!['class', 'struct'].includes(tokens[i].value) || !/^[A-Za-z_]\w*$/.test(tokens[i + 1]?.value ?? '')) continue;
      let body = i + 2;
      while (body < tokens.length && !['{', ';', '}', ')'].includes(tokens[body].value)) body++;
      if (tokens[body]?.value !== '{') continue;
      const parent = types.get(tokens[i].enclosing);
      types.set(body, parent ? parent + '.' + tokens[i + 1].value : tokens[i + 1].value);
    }
    for (let i = 1; i + 2 < tokens.length; i++) {
      const owner = types.get(tokens[i].enclosing);
      if (!owner || !['TextObject', 'string'].includes(tokens[i].value) || !/^[A-Za-z_]\w*$/.test(tokens[i + 1].value)) continue;
      const name = tokens[i + 1].value;
      let cursor = i + 2;
      let arity = null;
      if (tokens[cursor].value === '(' && tokens[cursor].pair > cursor) {
        arity = ranges(tokens, cursor + 1, tokens[cursor].pair).length;
        cursor = tokens[cursor].pair + 1;
      }
      let reference;
      if (['=', '=>'].includes(tokens[cursor]?.value)) {
        reference = textReference(tokens, [cursor + 1, expressionEnd(tokens, cursor + 1)]);
      } else if (tokens[cursor]?.value === '{' && tokens[cursor].pair > cursor) {
        const end = tokens[cursor].pair;
        const returns = [];
        const getter = tokens[cursor + 1]?.value === 'get' ? cursor + 2 : cursor;
        if (tokens[getter]?.value === '=>') {
          reference = textReference(tokens, [getter + 1, expressionEnd(tokens, getter + 1)]);
        } else if (tokens[getter]?.value === '{') {
          for (let j = getter + 1; j < end; j++) {
            if (tokens[j].value === 'return') returns.push(j);
          }
          if (returns.length === 1 && tokens[returns[0]].enclosing === getter) {
            reference = textReference(tokens, [returns[0] + 1, expressionEnd(tokens, returns[0] + 1)]);
          }
        }
        // Each member is examined once, including properties with a block getter.
        i = end;
      }
      if (reference) entries.push({ owner, name, arity, reference });
    }
    return entries;
  }

  function textLiteral(tokens, range, allowTextObject = false, extended = false) {
    if (!range) throw new Error('Falta el texto.');
    let [start, end] = range;
    const outer = { start: tokens[start].start, end: tokens[end - 1].end };
    if (extended && tokens[start].value === 'ConversationAnimation' && tokens[start + 1]?.value === '.'
      && ['Tag', 'TagLeading'].includes(tokens[start + 2]?.value) && tokens[start + 3]?.pair === end - 1) {
      [start, end] = ranges(tokens, start + 4, end - 1)[0];
    }
    if (allowTextObject && tokens[start]?.value === 'new' && tokens[start + 1]?.value === 'TextObject'
      && tokens[start + 2]?.pair === end - 1) {
      const values = ranges(tokens, start + 3, end - 1);
      if (values.length !== 1 && !(extended && values.length === 2
        && /^(?:\((?:I?Dictionary)<string,object>\))?null$/.test(tokens.slice(...values[1]).map(token => token.value).join('')))) {
        throw new Error('TextObject con atributos calculados.');
      }
      [start, end] = values[0];
    }
    const value = literal(tokens, [start, end], 'El texto');
    const localized = value.match(/^\{=([^}]+)\}/);
    return {
      localization: localized?.[1] ?? '', text: localized ? value.slice(localized[0].length) : value,
      textRange: { start: tokens[start].start, end: tokens[end - 1].end },
      textOuter: outer,
    };
  }

  function sourceText(source, tokens, range, allowTextObject, extended, symbols) {
    try {
      return textLiteral(tokens, range, allowTextObject, extended);
    } catch (error) {
      const code = extended && readCode(source, tokens, range);
      if (!code) throw error;
      return { localization: '', text: code, computedText: true, reference: textReference(tokens, range, symbols?.definitionAt) };
    }
  }

  function numberValue(value) {
    return /^-?\d[\d_]*$/.test(value) ? Number(value.replaceAll('_', '')) : NaN;
  }

  function flatLine(source, tokens, i, priorityFor, extended, symbols) {
    const method = tokens[i].value;
    const repeat = method === 'AddRepeatablePlayerLine';
    const speaker = method === 'AddDialogLine' ? 'npc' : 'player';
    const names = repeat ? [...flatParams.slice(0, 4), 'continueListingRepeatedObjectsText', 'continueListingOptionOutputToken', ...flatParams.slice(4)]
      : (speaker === 'player' ? [...flatParams, 'persuasionOptionDelegate'] : flatParams);
    const values = args(tokens, i + 1, names);
    const code = key => readCode(source, tokens, values.get(key));
    const string = (key, label) => literal(tokens, values.get(key), label);
    const priorityCode = code('priority');
    const argumentCode = {};
    let template = false;
    function identifier(key, label) {
      try {
        return string(key, label);
      } catch (error) {
        if (!extended || !values.has(key)) throw error;
        const resolved = symbols.resolve(values.get(key));
        argumentCode[key] = code(key);
        if (resolved === undefined || resolved.includes('$')) template = true;
        return resolved ?? symbols.symbol(values.get(key));
      }
    }
    const line = {
      speaker, key: identifier('id', 'El ID'), from: identifier('inputToken', 'El token de entrada'), to: identifier('outputToken', 'El token de salida'),
      ...sourceText(source, tokens, values.get('text'), false, extended, symbols), condition: code('conditionDelegate'), consequence: code('consequenceDelegate'),
      clickable: code('clickableConditionDelegate'), persuasion: code('persuasionOptionDelegate'),
      priority: priorityFor(priorityCode),
      ...(repeat ? { repeat: true } : {}),
    };
    const repeatArgs = repeat ? [code('continueListingRepeatedObjectsText'), code('continueListingOptionOutputToken')] : [];
    return { priorityCode, method, repeatArgs, argumentCode, template, lines: [line] };
  }

  function flow(source, tokens, start, end, priorityFor, generatedToken, extended, symbols) {
    if (tokens[start]?.value !== 'DialogFlow' || tokens[start + 1]?.value !== '.' || tokens[start + 2]?.value !== 'CreateDialogFlow') {
      throw new Error('El flujo se construye fuera de la llamada a AddDialogFlow.');
    }
    const createClose = tokens[start + 3]?.pair;
    const creation = args(tokens, start + 3, ['inputToken', 'priority']);
    const entry = literal(tokens, creation.get('inputToken'), 'El token inicial');
    const priority = priorityFor(readCode(source, tokens, creation.get('priority')));
    const levels = [];
    const lines = [];
    let current = entry;
    let last;

    for (let i = createClose + 1; i < end;) {
      const method = tokens[i + 1]?.value;
      const close = tokens[i + 2]?.pair;
      if (tokens[i]?.value !== '.' || close <= i + 2 || close >= end) throw new Error('Cadena DialogFlow incompleta.');
      const code = range => readCode(source, tokens, range);
      const definition = flowLines.get(method);
      if (definition) {
        const [speaker, option, names] = definition;
        const values = args(tokens, i + 2, names);
        const parent = option ? levels.at(-1) : { token: current };
        if (!parent || (option && parent.speaker !== speaker)) throw new Error('Opción fuera de su bloque DialogFlow.');
        const from = code(values.get('inputToken')) ? literal(tokens, values.get('inputToken'), 'El token de entrada') : parent.token;
        const to = code(values.get('outputToken')) ? literal(tokens, values.get('outputToken'), 'El token de salida') : generatedToken();
        const text = sourceText(source, tokens, values.get(names[0]), true, extended, symbols);
        last = { speaker, from, to, ...text, originalText: code(values.get(names[0])), condition: code(values.get('conditionDelegate')),
          consequence: '', clickable: '', persuasion: '', speakerCallback: code(values.get('speakerDelegate')),
          listener: code(values.get('listenerDelegate')), priority };
        lines.push(last);
        current = to;
      } else if (method === 'BeginPlayerOptions' || method === 'BeginNpcOptions') {
        const values = args(tokens, i + 2, ['inputToken', 'optionUsedOnce']);
        if (values.has('optionUsedOnce') && code(values.get('optionUsedOnce')) !== 'false') {
          throw new Error('El flujo usa opciones de un solo uso.');
        }
        const token = code(values.get('inputToken')) ? literal(tokens, values.get('inputToken'), 'El token de opciones') : current;
        levels.push({ token, speaker: method === 'BeginPlayerOptions' ? 'player' : 'npc' });
      } else if (method === 'EndPlayerOptions' || method === 'EndNpcOptions') {
        args(tokens, i + 2, []);
        const level = levels.pop();
        if (!level || (method === 'EndPlayerOptions') !== (level.speaker === 'player')) throw new Error('Bloques de opciones sin pareja.');
      } else if (flowCallbacks.has(method) && last) {
        const names = { Condition: 'conditionDelegate', Consequence: 'consequenceDelegate', ClickableCondition: 'clickableConditionDelegate' };
        const values = args(tokens, i + 2, [names[method]]);
        if (!values.has(names[method])) throw new Error('Falta el argumento de ' + method + '.');
        last[flowCallbacks.get(method)] = code(values.get(names[method]));
      } else if ((method === 'CloseDialog' || method === 'GotoDialogState' || method === 'GoBackToDialogState') && last) {
        const name = method === 'GoBackToDialogState' ? 'iState' : 'input';
        const values = args(tokens, i + 2, method === 'CloseDialog' ? [] : [name]);
        current = method === 'CloseDialog' ? 'close_window' : literal(tokens, values.get(name), 'El token de destino');
        if (method !== 'GoBackToDialogState') last.to = current;
      } else {
        throw new Error('Operación de DialogFlow no reconocida: ' + method + '.');
      }
      i = close + 1;
    }
    if (!lines.length || levels.length) throw new Error('El flujo no tiene líneas o tiene un bloque sin cerrar.');
    return { entry, start, createClose, lines };
  }

  function methodAt(tokens, index) {
    for (let i = tokens[index]?.enclosing; i !== undefined; i = tokens[i].enclosing) {
      if (tokens[i].value !== '{' || tokens[i - 1]?.value !== ')') continue;
      const open = tokens[i - 1].pair;
      const name = tokens[open - 1]?.value;
      if (!name || ['if', 'foreach', 'for', 'while', 'switch', 'catch', 'using', 'lock'].includes(name)) continue;
      if (/^\w+$/.test(name)) return { name, open, body: i, type: tokens[open - 2]?.value };
    }
    return null;
  }

  function sourceSymbols(tokens) {
    const definitions = new Map();
    const callSites = new Map();
    const inRoleHub = tokens.some((token, i) => token.value === 'class' && tokens[i + 1]?.value === 'RoleHub');
    for (let i = 1; i + 2 < tokens.length; i++) {
      const name = tokens[i].value;
      if (!/^[A-Za-z_]\w*$/.test(name)) continue;
      if (['string', 'var', 'TextObject'].includes(tokens[i - 1].value) && tokens[i + 1].value === '=') {
        const end = expressionEnd(tokens, i + 2);
        if (tokens[end]?.value === ';') {
          if (!definitions.has(name)) definitions.set(name, []);
          definitions.get(name).push({ at: i, range: [i + 2, end], member: ['const', 'readonly'].includes(tokens[i - 2]?.value) });
        }
      }
      const close = tokens[i + 1].pair;
      if (tokens[i + 1].value === '(' && close > i && tokens[close + 1]?.value === ';') {
        if (!callSites.has(name)) callSites.set(name, []);
        callSites.get(name).push(i);
      }
    }
    function visible(index, owner) {
      for (let scope = tokens[index]?.enclosing; scope !== undefined; scope = tokens[scope].enclosing) {
        if (scope === owner) return true;
      }
      return owner === undefined;
    }
    const definitionAt = (name, start) => definitions.get(name)?.findLast(item => (item.at < start || item.member) && visible(start, tokens[item.at].enclosing));
    function resolve(range, depth = 0) {
      if (!range || depth > 12) return undefined;
      try { return literal(tokens, range, 'El argumento'); } catch { /* continue with symbols */ }
      const [start, end] = range;
      if (tokens[start]?.value === '(' && tokens[start].pair === end - 1) return resolve([start + 1, end - 1], depth + 1);
      for (let i = end - 1; i >= start; i--) {
        if (tokens[i].pair >= start && tokens[i].pair < i) { i = tokens[i].pair; continue; }
        if (tokens[i].value === '+') {
          const left = resolve([start, i], depth + 1);
          const right = resolve([i + 1, end], depth + 1);
          if (left !== undefined && right !== undefined) return left + right;
          return undefined;
        }
      }
      const tag = tokens[start]?.value;
      const helper = tag === 'RoleHub' && tokens[start + 1]?.value === '.' ? start + 2 : (inRoleHub ? start : -1);
      if (helper >= start && tokens[helper + 1]?.value === '(' && tokens[helper + 1].pair === end - 1) {
        const method = tokens[helper].value;
        const role = resolve([helper + 2, end - 1], depth + 1);
        const suffix = { EntryId: '_entry', ReceiverToken: '', OptionsToken: '_options', ReturnToken: '_return' };
        const courted = { EntryId: 're_dat_player_callon_entry', ReceiverToken: 're_dat_callon_hub', OptionsToken: 're_dat_callon_options', ReturnToken: 're_dat_callon_return' };
        if (role && Object.hasOwn(suffix, method)) return role === 'courted' ? courted[method] : 're_hub_' + role + suffix[method];
      }
      if (end - start === 5 && tag === 'RoleHub' && tokens[start + 2]?.value === 'Role') return tokens[start + 4].value.toLowerCase();
      if (end - start !== 1 || !/^[A-Za-z_]\w*$/.test(tag)) return undefined;
      const definition = definitionAt(tag, start);
      if (definition) return resolve(definition.range, depth + 1) ?? symbol(range);
      const method = methodAt(tokens, start);
      if (method) {
        const params = ranges(tokens, method.open + 1, tokens[method.open].pair);
        const parameter = params.findIndex(([, stop]) => tokens[stop - 1].value === tag);
        const calls = callSites.get(method.name) ?? [];
        if (parameter >= 0 && calls.length === 1) {
          const call = calls[0];
          const value = resolve(ranges(tokens, call + 2, tokens[call + 1].pair)[parameter], depth + 1);
          if (value !== undefined) return value;
        }
      }
      return tag === 'role' ? '$role$' : symbol(range);
    }
    function symbol([start, end]) {
      const expression = tokens.slice(start, end).map(token => token.value).join('');
      const scope = methodAt(tokens, start)?.name ?? 'clase';
      const label = (scope + '_' + expression).replace(/[^\w]+/g, '_').slice(0, 130);
      // Keep long or non-identical expressions with similar labels apart.
      let hash = 0;
      for (const char of expression) hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
      return '$' + label + '_' + hash.toString(36) + '$';
    }
    return { resolve, symbol, definitionAt };
  }

  function parse(source, name, extended = false) {
    const tokens = lex(source);
    const warnings = [];
    const slots = [];
    const symbols = extended ? sourceSymbols(tokens) : null;
    const references = [];
    const factories = new Set();
    const methods = extended ? ['AddDialogLine', 'AddPlayerLine', 'AddDialogFlow', 'AddRepeatablePlayerLine']
      : ['AddDialogLine', 'AddPlayerLine', 'AddDialogFlow'];
    const questFields = new Set(['OfferDialogFlow', 'DiscussDialogFlow', 'QuestCharacterDialogFlow']);
    const constants = new Map();
    for (let i = 0; i + 5 < tokens.length; i++) {
      if (tokens[i].value !== 'const' || tokens[i + 1].value !== 'int' || tokens[i + 3].value !== '=') continue;
      const end = tokens[i + 4].value === '-' ? i + 6 : i + 5;
      if (tokens[end]?.value !== ';') continue;
      const value = tokens.slice(i + 4, end).map(token => token.value).join('');
      if (Number.isInteger(numberValue(value))) constants.set(tokens[i + 2].value, numberValue(value));
    }
    const priorityFor = value => {
      const priority = constants.get(value) ?? numberValue(value);
      return Number.isInteger(priority) && priority >= -2147483648 && priority <= 2147483647 ? String(priority) : '100';
    };
    const prefix = 'cq_forge_' + name.replace(/\.cs$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50) + '_';
    let flowNumber = 0;

    function flowSlot(start, end, lineNumber, origin) {
      let counter = 0;
      const generatedToken = () => {
        let token;
        do { token = prefix + flowNumber + '_' + ++counter; } while (source.includes(token));
        return token;
      };
      const parsed = flow(source, tokens, start, end, priorityFor, generatedToken, extended, symbols);
      return { kind: 'flow', ...parsed, start: tokens[start].start, end: tokens[end - 1].end, lineNumber, origin,
        creation: source.slice(tokens[start].start, tokens[parsed.createClose].end) };
    }

    const lineAt = index => source.slice(0, tokens[index].start).split(/\r\n|\r|\n/).length;
    const warn = (line, label, message) => warnings.push('Línea ' + line + ' · ' + label + ' · ' + message + ' Se conserva el código original.');

    for (let i = 2; i < tokens.length; i++) {
      const method = tokens[i].value;
      if (extended && method === 'DialogFlow' && tokens[i + 2]?.value === 'CreateDialogFlow') {
        const owner = methodAt(tokens, i);
        const field = tokens[i - 1].value === '=' ? tokens[i - 2].value : '';
        const factory = tokens[i - 1].value === 'return' && owner?.type === 'DialogFlow' ? owner.name : '';
        const local = field && ['DialogFlow', 'var'].includes(tokens[i - 3]?.value) ? field : '';
        const origin = questFields.has(field) ? field : (factory || local);
        if (!origin) continue;
        const start = i;
        let end = tokens[i + 3]?.pair + 1;
        while (tokens[end]?.value === '.' && tokens[end + 2]?.value === '(' && tokens[end + 2].pair > end + 2) {
          end = tokens[end + 2].pair + 1;
        }
        if (tokens[end]?.value !== ';') continue;
        flowNumber++;
        const lineNumber = lineAt(i);
        try {
          slots.push(flowSlot(start, end, lineNumber, origin));
          factories.add(origin);
        } catch (error) { warn(lineNumber, origin, error.message); }
        i = end;
        continue;
      }
      if (!methods.includes(method)
        || tokens[i - 1].value !== '.' || tokens[i + 1]?.value !== '(') continue;
      if (method === 'AddDialogFlow') flowNumber++;
      const end = tokens[i + 1].pair;
      const lineNumber = lineAt(i);
      try {
        if (end <= i || tokens[end + 1]?.value !== ';') throw new Error('El registro debe ser una instrucción independiente.');
        const body = source.slice(tokens[i + 1].start, tokens[end].end);
        if (/^\s*#/m.test(body)) throw new Error('El registro contiene directivas de preprocesador.');
        let slot;
        if (method === 'AddDialogFlow') {
          const values = args(tokens, i + 1, ['dialogFlow', 'relatedObject']);
          const [flowStart, flowEnd] = values.get('dialogFlow') ?? [];
          if (extended && tokens[flowStart]?.value !== 'DialogFlow') {
            const expression = readCode(source, tokens, values.get('dialogFlow'));
            const reference = expression.match(/^(?:this\.)?([A-Za-z_]\w*)(?:\s*\(|$)/)?.[1];
            references.push({ reference, lineNumber, at: i });
            i = end;
            continue;
          }
          slot = flowSlot(flowStart, flowEnd, lineNumber);
        } else {
          let receiverStart = i - 2;
          while (tokens[receiverStart - 1]?.value === '.' && receiverStart >= 2) receiverStart -= 2;
          const receiver = tokens.slice(receiverStart, i - 1).map(token => token.value).join('');
          if (!/^(?:@?[\p{L}_][\p{L}\p{N}_]*\.)*@?[\p{L}_][\p{L}\p{N}_]*$/u.test(receiver)
            || !['{', '}', ';', ')', 'else'].includes(tokens[receiverStart - 1]?.value) && receiverStart !== 0) {
            throw new Error('El receptor del registro no es un identificador o una propiedad.');
          }
          slot = { kind: 'flat', receiver, start: tokens[receiverStart].start, end: tokens[end].end,
            ...flatLine(source, tokens, i, priorityFor, extended, symbols) };
        }
        slots.push({ ...slot, lineNumber, statementEnd: tokens[end + 1].end });
      } catch (error) {
        warn(lineNumber, method, error.message);
      }
      if (end > i) i = end;
    }
    for (const ref of references) {
      if (factories.has(ref.reference)) continue;
      const scope = methodAt(tokens, ref.at);
      const alias = scope && tokens.findIndex((token, i) => i > scope.body && i < ref.at && token.value === ref.reference
        && tokens[i + 1]?.value === '=' && tokens[i + 3]?.value === '(' && token.enclosing === scope.body);
      if (alias > 0 && factories.has(tokens[alias + 2].value)) continue;
      warn(ref.lineNumber, 'AddDialogFlow', 'No se pudo localizar la construcción del flujo.');
    }
    return { slots, warnings };
  }

  function build(source, filename, parsed) {
    const byToken = new Map();
    function find(token) {
      if (!byToken.has(token)) {
        const id = 'estado_' + (byToken.size + 1);
        byToken.set(token, { id, token, title: token, x: 0, y: 0, external: true });
      }
      return byToken.get(token);
    }
    const lines = [];
    const bySource = new Map();
    for (const [slot, registration] of parsed.slots.entries()) {
      for (const raw of registration.lines) {
        const { from, to, textRange, textOuter, originalText, reference, ...data } = raw;
        const sourceState = find(from);
        const destination = find(to);
        const id = 'linea_' + (lines.length + 1);
        const line = { id, ...data, key: data.key ?? 'cq_forge_' + id, slot, source: sourceState.id, destination: destination.id };
        lines.push(line);
        sourceState.external = false;
        if (!bySource.has(sourceState.id)) bySource.set(sourceState.id, []);
        bySource.get(sourceState.id).push(line);
      }
    }
    const states = [...byToken.values()];
    const incoming = new Set(lines.map(line => line.destination));
    const start = byToken.get('start');
    const entry = (start && !start.external ? start.id : undefined)
      ?? states.find(state => !incoming.has(state.id) && !state.external)?.id ?? lines[0].source;
    const levels = new Map();
    const ids = new Map(states.map(state => [state.id, state]));
    let nextColumn = 0;
    for (const root of [entry, ...states.map(state => state.id)]) {
      if (levels.has(root)) continue;
      levels.set(root, nextColumn);
      const pending = [root];
      for (let i = 0; i < pending.length; i++) {
        const level = levels.get(pending[i]);
        nextColumn = Math.max(nextColumn, level + 1);
        for (const line of bySource.get(pending[i]) ?? []) {
          if (levels.has(line.destination) || ids.get(line.destination).external) continue;
          levels.set(line.destination, level + 1);
          pending.push(line.destination);
        }
      }
      if (ids.get(root).external) levels.set(root, nextColumn++);
    }
    const bottoms = new Map();
    for (const state of states) {
      const group = bySource.get(state.id) ?? [];
      const first = group[0];
      const label = state.token.startsWith('cq_forge_') && first ? (first.localization || first.text.split('\n')[0]) : state.token;
      state.title = state.token === 'close_window' ? 'Cerrar conversación' : state.token === 'start' ? 'Inicio del encuentro'
        : label.replaceAll('_', ' ').slice(0, 100);
      const col = levels.get(state.id);
      state.x = col * 292;
      state.y = bottoms.get(col) ?? 0;
      bottoms.set(col, state.y + 105 + 51 * group.length);
    }
    return { version: 1, name: filename.replace(/\.cs$/i, '').slice(0, 100), entry, states, lines, csharp: { filename, source } };
  }

  function importFile(source, filename) {
    const parsed = parse(source, filename, true);
    if (!parsed.slots.length) throw new Error(parsed.warnings[0] || 'No se encontraron registros de diálogos de Bannerlord.');
    const project = build(source, filename, parsed);
    project.csharp.parser = 2;
    if (project.states.length > 250 || project.lines.length > 1000) throw new Error('El archivo supera el tamaño de grafo admitido.');
    analysis.set(project.csharp, parsed);
    return project;
  }

  function registrations(document) {
    if (!analysis.has(document)) analysis.set(document, parse(document.source, document.filename, document.parser === 2));
    return analysis.get(document);
  }

  function localizationReferences(document) {
    const result = new Map();
    let index = 0;
    for (const slot of registrations(document).slots) {
      for (const line of slot.lines) {
        index++;
        if (line.reference) result.set('linea_' + index, line.reference);
      }
    }
    return result;
  }

  function expressionIsBalanced(code) {
    if (!code) return true;
    const tokens = lex(code);
    if (!tokens.length) return false;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].pair > i) i = tokens[i].pair;
      else if (openers.has(tokens[i].value) || closers.has(tokens[i].value) || [',', ';', '#', '"', "'"].includes(tokens[i].value)) return false;
    }
    return true;
  }

  function exportFile(project, quote) {
    const { source, filename } = project.csharp;
    const parsed = registrations(project.csharp);
    if (!parsed.slots.length || project.lines.some(line => !parsed.slots[line.slot])) {
      throw new Error('No se pudieron identificar los registros originales de este proyecto.');
    }
    const original = build(source, filename, parsed);
    const tokensFor = data => new Map(data.states.map(state => [state.id, state.token]));
    const tokens = tokensFor(project);
    const originalTokens = tokensFor(original);
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    const dialogueText = line => quote((line.localization ? '{=' + line.localization + '}' : '') + line.text);
    const originals = new Map();
    const bySlot = new Map();
    for (const line of original.lines) {
      if (!bySlot.has(line.slot)) bySlot.set(line.slot, []);
      const items = bySlot.get(line.slot);
      originals.set(line.id, { line, raw: parsed.slots[line.slot].lines[items.length] });
      items.push(line);
    }

    function expressionText(line, raw) {
      if (raw?.computedText) {
        if (line.text !== raw.text || line.localization !== raw.localization) throw new Error('El texto calculado se edita en su expresión C# de origen.');
        return raw.originalText ?? raw.text;
      }
      if (!raw?.textRange) return dialogueText(line);
      const { textRange, textOuter } = raw;
      return source.slice(textOuter.start, textRange.start) + dialogueText(line) + source.slice(textRange.end, textOuter.end);
    }

    function serialize(slot, lines, states, indent) {
      if (slot.kind === 'flow') {
        const calls = lines.map(line => {
          const raw = originals.get(line.id)?.raw;
          const options = [expressionText(line, raw), 'inputToken: ' + quote(states.get(line.source)), 'outputToken: ' + quote(states.get(line.destination))];
          if (line.speakerCallback && line.speaker === 'npc') options.push('speakerDelegate: ' + line.speakerCallback);
          if (line.listener) options.push('listenerDelegate: ' + line.listener);
          let call = (line.speaker === 'player' ? '.PlayerLine(' : '.NpcLine(') + options.join(', ') + ')';
          if (line.condition) call += '.Condition(' + line.condition + ')';
          if (line.clickable) call += '.ClickableCondition(' + line.clickable + ')';
          if (line.consequence) call += '.Consequence(' + line.consequence + ')';
          return call;
        });
        return [slot.creation, ...calls].join(newline + indent);
      }
      const calls = lines.map(line => {
        const raw = originals.get(line.id)?.raw;
        const from = states.get(line.source);
        const to = states.get(line.destination);
        if (slot.template && (!raw || raw.from !== from || raw.to !== to || raw.key !== line.key || raw.speaker !== line.speaker)) {
          throw new Error('La línea parametrizada «' + line.key + '» usa rutas calculadas en C#. Edita su texto o conserva sus conexiones originales.');
        }
        const repeat = raw?.repeat && line.speaker === 'player';
        const call = repeat ? slot.method : (line.speaker === 'player' ? 'AddPlayerLine' : 'AddDialogLine');
        const same = (name, value, before) => value === before && slot.argumentCode[name] ? slot.argumentCode[name] : quote(value);
        const args = [same('id', line.key, raw?.key), same('inputToken', from, raw?.from),
          same('outputToken', to, raw?.to), expressionText(line, raw)];
        if (repeat) args.push(...slot.repeatArgs);
        args.push(line.condition || 'null', line.consequence || 'null');
        const priority = line.priority === slot.lines[0].priority ? slot.priorityCode : String(Number(line.priority));
        if (priority) args.push('priority: ' + priority);
        if (line.clickable) args.push('clickableConditionDelegate: ' + line.clickable);
        if (line.persuasion && line.speaker === 'player' && !repeat) args.push('persuasionOptionDelegate: ' + line.persuasion);
        return slot.receiver + '.' + call + '(' + args.join(', ') + ')';
      });
      // A block keeps additions in the same scope even after an unbraced if or loop.
      if (calls.length > 1) return '{' + newline + indent + calls.join(';' + newline + indent) + ';' + newline + indent.slice(4) + '}';
      return calls[0] ?? '';
    }

    let cursor = 0;
    let output = '';
    function replace(start, end, value) {
      output += source.slice(cursor, start) + value;
      cursor = end;
    }
    for (const [index, slot] of parsed.slots.entries()) {
      const offset = Math.max(source.lastIndexOf('\r', slot.start - 1), source.lastIndexOf('\n', slot.start - 1)) + 1;
      const indent = source.slice(offset, slot.start).match(/^\s*/)[0] + '    ';
      const lines = project.lines.filter(line => line.slot === index);
      const originalLines = bySlot.get(index) ?? [];
      const actual = serialize(slot, lines, tokens, indent);
      const before = serialize(slot, originalLines, originalTokens, indent);
      if (actual === before) continue;
      const withOriginalText = lines.length === originalLines.length && serialize(slot, lines.map((line, i) => ({
        ...line, text: originalLines[i].text, localization: originalLines[i].localization,
      })), tokens, indent) === before;
      if (withOriginalText) {
        for (const [i, line] of lines.entries()) {
          const raw = slot.lines[i];
          if (raw.textRange && (line.text !== raw.text || line.localization !== raw.localization)) {
            replace(raw.textRange.start, raw.textRange.end, dialogueText(line));
          }
        }
      } else {
        const end = slot.kind === 'flat' && lines.length > 1 ? slot.statementEnd : slot.end;
        replace(slot.start, end, actual);
      }
    }
    return output + source.slice(cursor);
  }

  return { importFile, exportFile, registrations, expressionIsBalanced, localizationIndex, localizationReferences };
})();
