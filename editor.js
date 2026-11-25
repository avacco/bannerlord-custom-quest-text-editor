'use strict';

// Antes de que venga algún intelectual, *sí*, esto fue generado por IA. Creo que fue Opus 5.5. Ya ni me acuerdo.
// Osea, mira esta maraña, viejo. Ni aunque lo intente voy a entenderlo.
// Bueno, este sí es más entendible que el csharp. Pero igual.

(() => {
  const $ = id => document.getElementById(id);
  const board = $('board');
  const stage = $('stage');
  const canvas = $('connections');
  const context = canvas.getContext('2d');
  const inspector = $('inspector-content');
  const modal = $('modal');
  const modalContent = $('modal-content');
  const camera = { x: 0, y: 0, scale: 1 };
  let project = DialogueProject.demo();
  let opened = [project];
  let catalogs = [];
  let textSources = [];
  let translations = new Map();
  let xmlVariants = new Map();
  let textMembers = new Map();
  let language = '';
  const savedReferences = new WeakMap();
  const indexedSources = new WeakMap();
  const dirtyProjects = new Set();
  const dirtyCatalogs = new Set();
  let selectedState;
  let selectedLine;
  let connecting = null;
  let pointer = null;
  let drag = null;
  let suppressClick = false;
  let noticeTimer;
  let nextId = 0;
  let nextField = 0;
  let lastSlot = 0;

  function element(tag, className, label) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label !== undefined) node.textContent = label;
    return node;
  }

  function button(label, action, className) {
    const node = element('button', className, label);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  const findState = id => project.states.find(state => state.id === id);
  const findLine = id => project.lines.find(line => line.id === id);
  const linesFor = id => project.lines.filter(line => line.source === id);
  const registrations = () => project.csharp ? CSharpDialogue.registrations(project.csharp).slots : [];
  const titleOf = state => state.title.trim() || state.token || 'Estado sin nombre';
  const speakerOf = line => line.speaker === 'player' ? 'Jugador' : 'PNJ';
  const captionOf = line => displayText(line).trim().split('\n')[0] || (line.consequence ? 'Acción sin texto' : 'Línea sin texto');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function notice(message) {
    const node = $('notice');
    clearTimeout(noticeTimer);
    (modal.open ? modal : document.body).append(node);
    node.textContent = message;
    node.hidden = false;
    noticeTimer = setTimeout(() => { node.hidden = true; }, 3400);
  }

  function metadata() {
    const count = project.lines.length;
    const exits = project.states.filter(state => state.external).length;
    const size = `${count} ${count === 1 ? 'línea' : 'líneas'} · ${exits} ${exits === 1 ? 'salida' : 'salidas'}`;
    $('project-summary').textContent = `${size}${project.csharp ? ' · C#' : ''}${catalogs.length ? ' · XML ' + catalogs.length : ''}${textSources.length ? ' · Fuentes de texto ' + textSources.length : ''}${dirtyProjects.has(project) || dirtyCatalogs.size ? ' · Sin guardar' : ''}`;
    const { errors, warnings } = DialogueProject.validate(project);
    const issues = errors.length + warnings.length;
    $('validation-button').textContent = issues ? `Validación · ${issues}` : 'Validación';
    $('validation-button').classList.toggle('issues', Boolean(issues));
  }

  function change() {
    dirtyProjects.add(project);
    metadata();
    renderGraph();
  }

  function select(state, line) {
    selectedState = state;
    selectedLine = line;
    lastSlot = findLine(line)?.slot ?? lastSlot;
    connecting = null;
    renderGraph();
    renderInspector();
  }

  function renderGraph() {
    const focus = document.activeElement;
    const focusId = focus?.dataset.graphControl;
    const fragment = document.createDocumentFragment();
    let replacement;
    function identify(control, id) {
      control.dataset.graphControl = id;
      if (focusId === id) replacement = control;
    }

    for (const state of project.states) {
      const card = element('article', 'node');
      card.dataset.state = state.id;
      card.style.left = `${state.x}px`;
      card.style.top = `${state.y}px`;
      card.classList.toggle('external', state.external);
      card.classList.toggle('selected', state.id === selectedState);
      const head = button('', () => {
        if (connecting) {
          const line = findLine(connecting);
          line.destination = state.id;
          select(line.source, line.id);
          change();
          notice(`Conectado a «${titleOf(state)}».`);
          return;
        }
        select(state.id, linesFor(state.id)[0]?.id);
      }, 'node-head');
      identify(head, `state:${state.id}`);
      const role = state.external ? 'Salida al juego' : (state.id === project.entry ? 'Inicio' : 'Estado');
      head.append(element('span', 'node-kind', role), element('span', 'node-title', titleOf(state)),
        element('span', 'node-token', state.token || 'Sin token'), element('span', 'node-port'));
      card.append(head);

      for (const line of linesFor(state.id)) {
        const row = element('div', 'node-row');
        row.dataset.line = line.id;
        const choice = button('', () => select(state.id, line.id), 'node-line');
        identify(choice, `line:${line.id}`);
        choice.classList.toggle('active', line.id === selectedLine);
        choice.append(element('span', `line-type ${line.speaker}`, speakerOf(line)), element('span', 'line-caption', captionOf(line)));
        choice.title = displayText(line);
        const port = button('', () => {
          connecting = connecting === line.id ? null : line.id;
          pointer = null;
          renderGraph();
          if (connecting) notice('Selecciona el estado de destino. Pulsa Esc para cancelar.');
        }, 'line-port');
        identify(port, `port:${line.id}`);
        port.setAttribute('aria-label', `Conectar línea ${line.key}`);
        port.setAttribute('aria-pressed', String(connecting === line.id));
        port.disabled = Boolean(registrations()[line.slot]?.template);
        port.title = port.disabled ? 'Destino calculado por el código C#' : 'Conectar a un estado';
        row.append(choice, port);
        card.append(row);
      }
      if (!state.external && !linesFor(state.id).length) {
        const add = button('+ Añadir línea', () => addLine(state), 'empty-line');
        identify(add, `add:${state.id}`);
        card.append(add);
      }
      fragment.append(card);
    }

    stage.replaceChildren(fragment);
    board.classList.toggle('is-connecting', Boolean(connecting));
    replacement?.focus({ preventScroll: true });
    applyCamera();
  }

  function applyCamera() {
    stage.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
    $('zoom-value').value = `${Math.round(camera.scale * 100)}%`;
    draw();
  }

  function draw() {
    const width = board.clientWidth;
    const height = board.clientHeight;
    if (!width || !height) return;
    const density = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * density) || canvas.height !== Math.round(height * density)) {
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, width, height);
    const interval = 23 * Math.max(.65, camera.scale);
    const offset = value => (value % interval + interval) % interval;
    context.fillStyle = '#414438';
    for (let x = offset(camera.x); x < width; x += interval) {
      for (let y = offset(camera.y); y < height; y += interval) context.fillRect(x, y, 1.15, 1.15);
    }

    const nodes = new Map([...stage.children].map(card => [card.dataset.state, card]));
    const rows = new Map([...stage.querySelectorAll('[data-line]')].map(row => [row.dataset.line, row]));
    const x = value => camera.x + value * camera.scale;
    const y = value => camera.y + value * camera.scale;
    const from = (card, row) => ({ x: x(card.offsetLeft + card.offsetWidth), y: y(card.offsetTop + row.offsetTop + row.offsetHeight / 2) });
    context.lineWidth = 1.65;
    context.lineCap = 'round';
    const ordered = [...project.lines].sort((a, b) => Number(a.id === selectedLine) - Number(b.id === selectedLine));
    for (const line of ordered) {
      const source = nodes.get(line.source);
      const destination = nodes.get(line.destination);
      const row = rows.get(line.id);
      if (!source || !destination || !row) continue;
      const start = from(source, row);
      const head = destination.querySelector('.node-head');
      const endX = x(destination.offsetLeft);
      const endY = y(destination.offsetTop + head.offsetHeight / 2);
      const isReturn = destination.offsetLeft < source.offsetLeft - 8;
      const isVertical = Math.abs(destination.offsetLeft - source.offsetLeft) <= 8;
      const isActive = selectedLine === line.id;
      const color = destination.classList.contains('external') ? '#9182ac' : (isReturn ? '#849871' : '#6c7664');
      context.strokeStyle = isActive ? '#f3ba73' : color;
      context.fillStyle = context.strokeStyle;
      context.setLineDash(isReturn ? [5, 5] : []);
      context.beginPath();
      context.moveTo(start.x, start.y);
      if (isVertical || isReturn) {
        const sameState = source === destination;
        const bottom = y(source.offsetTop + source.offsetHeight);
        const lane = sameState ? bottom + 17 * camera.scale : Math.max(start.y, bottom + 10 * camera.scale);
        const left = endX - (isReturn ? 21 : 15) * camera.scale;
        const right = start.x + 16 * camera.scale;
        context.bezierCurveTo(right, start.y, right, lane, right, lane);
        context.lineTo(left, lane);
        context.bezierCurveTo(left, lane, left, endY, endX, endY);
      } else {
        const obstacles = [...nodes.values()].filter(card => x(card.offsetLeft) >= start.x
          && x(card.offsetLeft + card.offsetWidth) <= endX);
        const isBlocked = obstacles.some(card => y(card.offsetTop) < Math.max(start.y, endY)
          && y(card.offsetTop + card.offsetHeight) > Math.min(start.y, endY));
        if (isBlocked) {
          const lane = Math.max(start.y, endY, ...obstacles.map(card => y(card.offsetTop + card.offsetHeight))) + 31 * camera.scale;
          const left = start.x + 25 * camera.scale;
          const right = endX - 25 * camera.scale;
          context.bezierCurveTo(left, start.y, left, lane, left, lane);
          context.lineTo(right, lane);
          context.bezierCurveTo(right, lane, right, endY, endX, endY);
        } else {
          const offset = Math.max(25 * camera.scale, (endX - start.x) / 2);
          context.bezierCurveTo(start.x + offset, start.y, endX - offset, endY, endX, endY);
        }
      }
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(endX - 4 * camera.scale, endY);
      context.lineTo(endX - 10 * camera.scale, endY - 3.2 * camera.scale);
      context.lineTo(endX - 10 * camera.scale, endY + 3.2 * camera.scale);
      context.fill();
    }

    const line = findLine(connecting);
    if (line && pointer) {
      const start = from(nodes.get(line.source), rows.get(line.id));
      context.strokeStyle = '#f3ba73';
      context.setLineDash([5, 5]);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(pointer.x, pointer.y);
      context.stroke();
      context.setLineDash([]);
    }
  }

  function fit() {
    if (!stage.children.length) return;
    const cards = [...stage.children];
    const left = Math.min(...cards.map(card => card.offsetLeft));
    const right = Math.max(...cards.map(card => card.offsetLeft + card.offsetWidth));
    const top = Math.min(...cards.map(card => card.offsetTop));
    const bottom = Math.max(...cards.map(card => card.offsetTop + card.offsetHeight));
    const width = board.clientWidth;
    const height = board.clientHeight;
    camera.scale = clamp(Math.min((width - 95) / (right - left), (height - 122) / (bottom - top)), .06, 1.1);
    camera.x = (width - (right - left) * camera.scale) / 2 - left * camera.scale;
    camera.y = (height - (bottom - top) * camera.scale) / 2 - top * camera.scale;
    applyCamera();
  }

  function focusOnSelection() {
    const card = [...stage.children].find(node => node.dataset.state === selectedState);
    if (!card || camera.scale >= .8) return;
    camera.scale = .8;
    camera.x = (board.clientWidth - card.offsetWidth * camera.scale) / 2 - card.offsetLeft * camera.scale;
    camera.y = (board.clientHeight - card.offsetHeight * camera.scale) / 2 - card.offsetTop * camera.scale;
    applyCamera();
  }

  function zoom(factor, centerX = board.clientWidth / 2, centerY = board.clientHeight / 2) {
    const scale = clamp(camera.scale * factor, .06, 2.2);
    const ratio = scale / camera.scale;
    camera.x = centerX - (centerX - camera.x) * ratio;
    camera.y = centerY - (centerY - camera.y) * ratio;
    camera.scale = scale;
    applyCamera();
  }

  function field(label, control) {
    const wrapper = element('div', 'field');
    const caption = element('label', '', label);
    control.id = `edit-field-${++nextField}`;
    caption.htmlFor = control.id;
    wrapper.append(caption, control);
    return wrapper;
  }

  function textField(label, target, property, options = {}) {
    const input = element(options.multiline ? 'textarea' : 'input', options.mono ? 'mono' : '');
    input.value = target[property] ?? '';
    input.maxLength = options.max ?? 180;
    input.spellcheck = Boolean(options.multiline) && !options.mono;
    input.readOnly = Boolean(options.readOnly);
    if (options.placeholder) input.placeholder = options.placeholder;
    if (options.numeric) input.inputMode = 'numeric';
    input.addEventListener('input', () => {
      target[property] = options.raw ? input.value : input.value.trim();
      if (property === 'title') inspector.querySelector('.inspector-heading').textContent = titleOf(target);
      if (property === 'text') inspector.querySelector('.inspector-lines .active span:last-child').textContent = captionOf(target);
      change();
    });
    return field(label, input);
  }

  function selectField(label, value, options, update, disabled = false) {
    const control = element('select');
    for (const [key, title] of options) {
      const option = element('option', '', title);
      option.value = key;
      control.append(option);
    }
    control.value = value;
    control.disabled = disabled;
    control.addEventListener('change', () => { update(control.value); change(); });
    return field(label, control);
  }

  function linkedSources(state) {
    const token = state.token;
    const engineTokens = ['start', 'close_window', 'hero_main_options', 'lord_start', 'lord_pretalk', 'quest_discuss', 'issue_classic_quest_start'];
    if (!token || engineTokens.includes(token) || token.startsWith('cq_forge_')) return [];
    function matchesTemplate(template, value) {
      if (!template.includes('$role$') || value.includes('$role$')) return false;
      const [prefix, suffix] = template.split('$role$');
      return value.startsWith(prefix) && value.endsWith(suffix)
        && /^[a-z]+$/.test(value.slice(prefix.length, value.length - suffix.length));
    }
    const matches = [];
    for (const candidate of opened) {
      if (candidate === project) continue;
      for (const target of candidate.states) {
        if (target.external) continue;
        if (target.token === token || matchesTemplate(token, target.token)
          || matchesTemplate(target.token, token)) matches.push({ candidate, target });
      }
    }
    return matches;
  }

  function textDescriptor(line) {
    if (!line.computedText || !project.csharp) return { id: line.localization === '!' ? '' : line.localization, fallback: line.text };
    if (!savedReferences.has(project.csharp)) {
      savedReferences.set(project.csharp, CSharpDialogue.localizationReferences(project.csharp));
    }
    let reference = savedReferences.get(project.csharp).get(line.id);
    let owner = '';
    const visited = new Set();
    while (reference?.member) {
      const name = reference.member;
      const key = name + ':' + (reference.arity ?? 'field');
      if (visited.has(key)) return null;
      visited.add(key);
      const qualified = owner ? owner + '.' + key : key;
      const matches = textMembers.get(qualified) ?? textMembers.get(key);
      if (matches?.length !== 1) return null;
      owner = matches[0].owner;
      reference = matches[0].reference;
    }
    return reference ?? null;
  }

  function xmlText(line, descriptor = textDescriptor(line)) {
    const ids = new Set();
    if (descriptor?.id) ids.add(descriptor.id);
    const variable = descriptor?.fallback.match(/^\{([A-Z0-9_]+)\}$/)?.[1];
    if (variable) {
      for (const code of [line.condition, line.consequence]) {
        const pattern = /SetTextVariable\(\s*"([A-Z0-9_]+)"\s*,\s*(?:[A-Za-z_]\w*\.)+(?:Get\w+|FindText)\(\s*"([A-Za-z0-9_.-]+)"/g;
        for (const match of code.matchAll(pattern)) {
          if (match[1] === variable) ids.add(match[2]);
        }
      }
    }
    const matches = [];
    for (const id of ids) {
      matches.push(...(translations.get(id) ?? []));
      matches.push(...(xmlVariants.get(id) ?? []));
    }
    return [...new Set(matches)].sort((a, b) => Number(b.language === language) - Number(a.language === language));
  }

  function displayEntry(entries, descriptor) {
    const localized = entries.find(entry => entry.language === language) ?? entries.find(entry => !entry.language);
    if (localized || descriptor?.fallback) return localized;
    return entries.find(entry => entry.language === 'English') ?? entries[0];
  }

  function displayText(line) {
    const descriptor = textDescriptor(line);
    const entry = displayEntry(xmlText(line, descriptor), descriptor);
    return entry?.text ?? (descriptor?.fallback || (descriptor?.id ? `{=${descriptor.id}}` : line.text));
  }

  function catalogField(entry, primary) {
    const input = element('textarea');
    input.value = entry.text;
    input.readOnly = !entry.span;
    input.spellcheck = true;
    const label = primary ? 'Texto XML' : `Texto XML · ${entry.language || 'Sin idioma'} · ${entry.id}`;
    const wrapper = field(label, input);
    wrapper.classList.add('catalog-field');
    wrapper.append(element('small', 'muted mono', [entry.id, entry.language, entry.filename].filter(Boolean).join(' · ')));
    if (primary) wrapper.append(element('small', 'muted', 'El cambio se aplica a todas las líneas que usan esta entrada.'));
    if (!entry.span) wrapper.append(element('small', 'muted', 'El atributo de texto se muestra en modo de lectura.'));
    input.addEventListener('input', () => {
      try {
        entry.update(input.value);
      } catch (error) {
        input.value = entry.text;
        notice(error.message);
        return;
      }
      dirtyCatalogs.add(entry.catalog);
      metadata();
      renderGraph();
      for (const choice of inspector.querySelectorAll('.inspector-lines [data-line-choice]')) {
        const line = findLine(choice.dataset.lineChoice);
        if (line) choice.lastElementChild.textContent = captionOf(line);
      }
      const shown = inspector.querySelector('[data-shown-text]');
      const line = findLine(selectedLine);
      if (shown && line) shown.value = displayText(line);
    });
    return wrapper;
  }

  function renderInspector() {
    const state = findState(selectedState);
    if (!state) {
      inspector.replaceChildren(element('p', 'hint', 'Selecciona un estado del lienzo o añade uno nuevo.'));
      return;
    }
    const line = findLine(selectedLine);
    const section = element('div');
    const role = state.external ? 'Salida al juego' : (state.id === project.entry ? 'Inicio de la vista previa' : 'Estado del diálogo');
    const templateState = project.lines.some(option => (option.source === state.id || option.destination === state.id)
      && registrations()[option.slot]?.template);
    section.append(element('p', 'inspector-caption', role), element('h2', 'inspector-heading', titleOf(state)),
      textField('Nombre', state, 'title', { max: 100, raw: true }),
      textField('Token de Bannerlord', state, 'token', { mono: true, readOnly: templateState }));

    const links = linkedSources(state);
    if (links.length) {
      const list = element('div', 'source-links');
      list.append(element('p', 'inspector-caption', 'Continuaciones en otros archivos'));
      for (const { candidate, target } of links) {
        list.append(button(`${candidate.name} · ${target.token}`, () => load(candidate, target.id)));
      }
      section.append(list);
    }

    if (state.external) {
      section.append(element('p', 'hint', 'Bannerlord continúa desde este token. Usa close_window para cerrar la conversación.'));
    } else {
      const heading = element('div', 'section-bar');
      heading.append(element('h3', '', 'Líneas'), button('+ Añadir línea', () => addLine(state)));
      const list = element('div', 'inspector-lines');
      for (const option of linesFor(state.id)) {
        const choice = button('', () => {
          select(state.id, option.id);
          inspector.querySelector('.inspector-lines .active')?.focus();
        }, option.id === line?.id ? 'active' : '');
        choice.dataset.lineChoice = option.id;
        choice.append(element('span', `line-type ${option.speaker}`, speakerOf(option)), element('span', '', captionOf(option)));
        list.append(choice);
      }
      section.append(heading, list);
      if (line?.source === state.id) section.append(lineEditor(line));
    }

    const actions = element('div', 'inspector-actions');
    if (!state.external && state.id !== project.entry) {
      actions.append(button('Marcar como inicio', () => { project.entry = state.id; change(); renderInspector(); }, 'quiet'));
    }
    if (!templateState) actions.append(button('Eliminar estado', () => deleteState(state), 'quiet danger'));
    section.append(actions);
    const scroll = inspector.scrollTop;
    inspector.replaceChildren(section);
    inspector.scrollTop = scroll;
  }

  function lineEditor(line) {
    const container = element('div', 'line-edit');
    const destinations = project.states.map(state => [state.id, `${titleOf(state)}${state.external ? ' · Salida' : ''}`]);
    const destination = findState(line.destination) ? line.destination : '';
    const slot = registrations()[line.slot];
    const template = Boolean(slot?.template);
    const descriptor = textDescriptor(line);
    const xml = xmlText(line, descriptor);
    const displayed = displayEntry(xml, descriptor);
    const primary = displayed && (displayed.language === language || !displayed.language) ? displayed : null;
    const shown = displayText(line);
    if (primary) {
      container.append(catalogField(primary, true));
    } else if ((line.computedText && descriptor) || (descriptor?.id && shown !== line.text)) {
      const visibleText = textField('Texto mostrado', { text: shown }, 'text', { multiline: true, readOnly: true });
      visibleText.querySelector('textarea').dataset.shownText = '';
      container.append(visibleText);
    }
    if (descriptor?.id && !xml.length) {
      container.append(element('p', 'hint', 'Abre el catálogo XML que contiene «' + descriptor.id + '» para editar su traducción.'));
    }
    container.append(
      textField(line.computedText ? 'Referencia C#' : 'Texto', line, 'text', {
        max: 10000, raw: true, multiline: true, readOnly: line.computedText, placeholder: 'Escribe lo que dirá el personaje',
      }),
      selectField('Quién habla', line.speaker, [['player', 'Jugador'], ['npc', 'PNJ']], value => {
        line.speaker = value;
        const type = inspector.querySelector('.inspector-lines .active .line-type');
        type.className = `line-type ${line.speaker}`;
        type.textContent = speakerOf(line);
      }, template || line.repeat),
      selectField('Destino', destination, [['', 'Selecciona un estado'], ...destinations], value => { line.destination = value; }, template),
    );
    if (template) container.append(element('p', 'hint', 'Los tokens de esta plantilla se calculan al registrar el diálogo.'));
    if (line.repeat) container.append(element('p', 'hint', 'Bannerlord repite esta opción para cada elemento elegible.'));
    const otherEntries = xml.filter(entry => entry !== primary);
    if (otherEntries.length) {
      const details = element('details', 'text-catalog');
      details.append(element('summary', '', primary ? 'Otras traducciones y variantes' : 'Textos de los catálogos XML'),
        ...otherEntries.map(entry => catalogField(entry, false)));
      container.append(details);
    }
    const advanced = element('details');
    const callbackOptions = { max: slot ? 4096 : 240, mono: true, multiline: Boolean(slot) };
    advanced.append(element('summary', '', 'Condiciones, acciones e identificadores'),
      textField('Condición', line, 'condition', { ...callbackOptions, placeholder: 'Ej. CanAcceptRequest' }),
      textField('Consecuencia', line, 'consequence', { ...callbackOptions, placeholder: 'Ej. AcceptRequest' }));
    if (slot) {
      advanced.append(textField('Condición de disponibilidad', line, 'clickable', callbackOptions));
      if (slot.kind === 'flow') {
        advanced.append(textField('Delegado del hablante', line, 'speakerCallback', callbackOptions),
          textField('Delegado del oyente', line, 'listener', callbackOptions),
          element('p', 'hint', `${slot.origin || 'DialogFlow'} · línea ${slot.lineNumber} · prioridad ${line.priority} en la vista previa.`));
      } else {
        if (!line.repeat) advanced.append(textField('Delegado de persuasión', line, 'persuasion', callbackOptions));
      }
    } else {
      advanced.append(element('p', 'hint', 'Indica métodos C# disponibles en la clase que recibirá el código.'));
    }
    if (slot?.kind !== 'flow') {
      advanced.append(textField('ID de línea', line, 'key', { mono: true, readOnly: template }),
        textField('Prioridad', line, 'priority', { max: 12, numeric: true }));
    }
    const localization = line.computedText
      ? (descriptor?.id ? textField('Clave de traducción', { localization: descriptor.id }, 'localization', { mono: true, readOnly: true }) : null)
      : textField('Clave de traducción', line, 'localization', { mono: true });
    if (localization) advanced.append(localization);
    container.append(advanced);
    if (!template) container.append(button('Eliminar línea', () => {
      confirmAction('Eliminar línea', 'Se eliminará esta línea y su conexión de salida.', () => {
        project.lines = project.lines.filter(item => item !== line);
        select(line.source, linesFor(line.source)[0]?.id);
        change();
      });
    }, 'quiet danger'));
    return container;
  }

  function idFor(prefix) {
    let id;
    do { id = `${prefix}_${++nextId}`; }
    while (project.states.some(state => state.id === id || state.token === id) || project.lines.some(line => line.id === id || line.key === id));
    return id;
  }

  function addState(external) {
    if (project.states.length >= 250) { notice('El proyecto admite hasta 250 estados.'); return; }
    const id = idFor(external ? 'cq_salida' : 'cq_estado');
    const cards = [...stage.children];
    const x = clamp(Math.round((board.clientWidth / 2 - camera.x) / camera.scale - 112), -999_000, 999_000);
    let y = clamp(Math.round((board.clientHeight / 2 - camera.y) / camera.scale - 42), -999_000, 999_000);
    for (;;) {
      const overlap = cards.find(card => x + 239 > card.offsetLeft && x < card.offsetLeft + card.offsetWidth + 14
        && y + 126 > card.offsetTop && y < card.offsetTop + card.offsetHeight + 14);
      if (!overlap) break;
      y = overlap.offsetTop + overlap.offsetHeight + 15;
    }
    const closes = external && !project.states.some(state => state.token === 'close_window');
    const title = closes ? 'Cerrar conversación' : (external ? 'Nueva salida' : 'Nuevo estado');
    const state = { id, token: closes ? 'close_window' : id, x, y, title, external };
    project.states.push(state);
    if (!external && !findState(project.entry)) project.entry = id;
    select(id);
    change();
    const newCard = [...stage.children].find(card => card.dataset.state === id);
    if (camera.y + (y + newCard.offsetHeight) * camera.scale > board.clientHeight - 45) fit();
    inspector.querySelector('input')?.focus({ preventScroll: true });
  }

  function addLine(state) {
    if (project.lines.length >= 1000) { notice('El proyecto admite hasta 1000 líneas.'); return; }
    const id = idFor('cq_linea');
    const speaker = linesFor(state.id)[0]?.speaker ?? (state.id === project.entry ? 'player' : 'npc');
    const line = { id, source: state.id, speaker, destination: '', key: id, text: '', localization: '', condition: '', consequence: '', priority: '100' };
    if (project.csharp) {
      const selected = findLine(selectedLine);
      const slot = (selected?.source === state.id ? selected.slot : undefined)
        ?? linesFor(state.id)[0]?.slot ?? project.lines.find(item => item.destination === state.id)?.slot ?? lastSlot;
      const available = registrations();
      if (available[slot]?.template) {
        notice('Añade las líneas de esta plantilla en su método C# de registro.');
        return;
      }
      line.slot = slot;
      line.priority = available[slot].lines[0].priority;
    }
    project.lines.push(line);
    select(state.id, id);
    change();
    inspector.querySelector('textarea')?.focus({ preventScroll: true });
  }

  function deleteState(state) {
    const inbound = project.lines.filter(line => line.destination === state.id && line.source !== state.id).length;
    const detail = inbound ? ` Se quedarán sin destino ${inbound} ${inbound === 1 ? 'línea' : 'líneas'} de otros estados.` : '';
    confirmAction('Eliminar estado', `Se eliminará «${titleOf(state)}» con sus líneas.${detail}`, () => {
      project.states = project.states.filter(item => item !== state);
      project.lines = project.lines.filter(line => line.source !== state.id);
      for (const line of project.lines) {
        if (line.destination === state.id) line.destination = '';
      }
      if (project.entry === state.id) project.entry = project.states.find(item => !item.external)?.id ?? '';
      select(project.entry || project.states[0]?.id, linesFor(project.entry)[0]?.id);
      change();
    });
  }

  function openModal(title, ...children) {
    $('modal-title').textContent = title;
    modalContent.replaceChildren(...children);
    if (!modal.open) modal.showModal();
  }

  function confirmAction(title, message, action) {
    const row = element('div', 'modal-actions');
    const cancel = button('Cancelar', () => modal.close());
    row.append(cancel, button('Confirmar', () => { modal.close(); action(); }, 'primary'));
    openModal(title, element('p', '', message), row);
    cancel.focus();
  }

  function showValidation() {
    const { errors, warnings } = DialogueProject.validate(project);
    if (!errors.length && !warnings.length) {
      openModal('Validación', element('p', '', 'Todas las líneas tienen un destino y son accesibles desde el inicio.'));
      return;
    }
    const list = element('ul', 'error-list');
    list.append(...errors.map(message => element('li', 'error', message)), ...warnings.map(message => element('li', '', message)));
    const summary = errors.length ? 'Corrige los errores para exportar C# o probar el diálogo.' : 'El diálogo se puede exportar. Revisa estos avisos.';
    openModal('Validación', element('p', '', summary), list);
  }

  function download(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = element('a');
    link.download = filename;
    link.href = url;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportXml() {
    if (!catalogs.length) return;
    const choices = element('select');
    const edits = catalogs.map(catalog => catalogEntries(catalog).some(entry => entry.text !== entry.original));
    const line = findLine(selectedLine);
    const selectedCatalog = line ? displayEntry(xmlText(line), textDescriptor(line))?.catalog : null;
    for (const [index, catalog] of catalogs.entries()) {
      const label = [catalog.filename, LocalizationCatalog.read(catalog).language, edits[index] ? 'Editado' : ''].filter(Boolean).join(' · ');
      const option = element('option', '', label);
      option.value = String(index);
      choices.append(option);
    }
    const selectedIndex = catalogs.indexOf(selectedCatalog);
    const editedIndex = edits.indexOf(true);
    choices.value = String(edits[selectedIndex] ? selectedIndex : (editedIndex >= 0 ? editedIndex : Math.max(0, selectedIndex)));
    const actions = element('div', 'modal-actions');
    actions.append(button('Descargar copia XML', () => {
      const catalog = catalogs[Number(choices.value)];
      download(LocalizationCatalog.generate(catalog), 'application/xml;charset=utf-8', catalog.filename);
      notice('Catálogo XML descargado.');
    }, 'primary'));
    openModal('Exportar XML', field('Catálogo', choices), actions);
  }

  function fileName() {
    return project.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dialogo';
  }

  function exportCode() {
    if (DialogueProject.validate(project).errors.length) { showValidation(); return; }
    let code;
    try {
      code = DialogueProject.generate(project);
    } catch (error) {
      openModal('No se pudo exportar C#', element('p', '', error.message));
      return;
    }
    const filename = project.csharp ? project.csharp.filename.replace(/\.cs$/i, '.editado.cs') : `${fileName()}.cs`;
    const pre = element('pre', '', code);
    pre.tabIndex = 0;
    const actions = element('div', 'modal-actions');
    actions.append(button('Copiar código', async () => {
      try {
        await navigator.clipboard.writeText(code);
        notice('Código copiado.');
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(pre);
        selection.removeAllRanges();
        selection.addRange(range);
        if (document.execCommand('copy')) notice('Código copiado.');
        else notice('El código está seleccionado. Pulsa Ctrl+C para copiarlo.');
      }
    }), button('Descargar .cs', () => download(code, 'text/plain;charset=utf-8', filename), 'primary'));
    const hint = project.csharp
      ? `Se descargará una copia completa del archivo activo como ${filename}. Guardar JSON incluye las fuentes abiertas.`
      : 'Pega este método en la clase que registra la conversación. Si la clase ya tiene un método AddDialogs, integra o sustituye sus líneas.';
    openModal('Exportar C#', element('p', 'hint', hint), pre, actions);
  }

  function play() {
    if (DialogueProject.validate(project).errors.length) { showValidation(); return; }
    const previewStart = findState(selectedState)?.id ?? project.entry;
    let current = previewStart;
    const history = [];
    const active = new Set(project.lines.flatMap(line => [line.condition, line.clickable]).filter(Boolean));
    const conditions = element('details', 'preview-conditions');
    const list = element('div', 'condition-list');
    const preview = element('div', 'preview-stage');
    for (const name of active) {
      const label = element('label', 'mono');
      const toggle = element('input');
      toggle.type = 'checkbox';
      toggle.checked = true;
      toggle.addEventListener('change', () => { if (toggle.checked) active.add(name); else active.delete(name); drawPreview(); });
      label.append(toggle, document.createTextNode(` ${name}`));
      list.append(label);
    }
    conditions.append(element('summary', '', 'Simular condiciones C#'), element('p', 'hint', 'Marca las condiciones que se tomarán como verdaderas en la simulación.'), list);

    function paragraphFor(line) {
      const row = element('div', `preview-line ${line.speaker}`);
      const text = displayText(line);
      row.append(element('span', `line-type ${line.speaker}`, speakerOf(line)), element('span', '', text));
      if (line.consequence) row.append(element('span', 'hint mono', `Acción asociada · ${line.consequence}`));
      return row;
    }

    function drawPreview(focusNext = false) {
      const state = findState(current);
      const cards = history.slice(-3).map(paragraphFor);
      preview.replaceChildren(element('p', 'inspector-caption', titleOf(state)), ...cards);
      if (state.external) {
        const message = state.token === 'close_window' ? 'Fin de la conversación.' : `Continúa en el juego con «${state.token}».`;
        preview.append(element('p', 'hint', message));
        return;
      }
      const available = linesFor(current).filter(line => !line.condition || active.has(line.condition));
      available.sort((a, b) => Number(b.priority) - Number(a.priority));
      if (!available.length) {
        preview.append(element('p', 'hint', 'Ninguna línea está disponible con estas condiciones.'));
        return;
      }
      const options = element('div', 'preview-options');
      const npc = available.find(line => line.speaker === 'npc');
      const follow = line => {
        history.push(line);
        current = line.destination;
        drawPreview(true);
      };
      if (npc) {
        preview.append(paragraphFor(npc));
        options.append(button('Continuar', () => follow(npc), 'primary'));
      } else {
        options.append(...available.map(line => {
          const text = displayText(line);
          const choice = button(line.repeat ? `Lista dinámica · ${text}` : text, () => follow(line));
          choice.disabled = Boolean(line.clickable && !active.has(line.clickable));
          return choice;
        }));
      }
      preview.append(options);
      if (focusNext) options.firstElementChild.focus();
    }

    const actions = element('div', 'modal-actions');
    actions.append(button('Reiniciar', () => { current = previewStart; history.length = 0; drawPreview(true); }));
    openModal('Probar diálogo', ...(active.size ? [conditions] : []), preview, actions);
    drawPreview();
  }

  function load(data, selected) {
    project = data;
    lastSlot = 0;
    $('project-name').value = project.name;
    const state = selected ?? findState(project.entry)?.id ?? project.states[0]?.id;
    select(state, linesFor(state)[0]?.id);
    renderSources();
    metadata();
    fit();
    if (window.matchMedia('(max-width: 700px)').matches || (project.csharp && camera.scale < .45)) focusOnSelection();
  }

  function renderSources() {
    const picker = $('source-picker');
    picker.hidden = opened.length < 2;
    picker.replaceChildren(...opened.map((item, index) => {
      const option = element('option', '', item.csharp?.filename ?? item.name);
      option.value = String(index);
      return option;
    }));
    picker.value = String(opened.indexOf(project));
  }

  function catalogEntries(catalog) {
    return LocalizationCatalog.read(catalog).entries;
  }

  function catalogKey(catalog) {
    return catalog.filename + '\0' + LocalizationCatalog.read(catalog).language;
  }

  function setCatalogs(files, preferred = language) {
    const index = new Map();
    const variants = new Map();
    const languages = new Set();
    for (const catalog of files) {
      for (const entry of catalogEntries(catalog)) {
        if (entry.language) languages.add(entry.language);
        if (!index.has(entry.id)) index.set(entry.id, []);
        index.get(entry.id).push(entry);
        const base = entry.id.match(/^(.*)_\d+(?:_[ab])?$/)?.[1];
        if (base) {
          if (!variants.has(base)) variants.set(base, []);
          variants.get(base).push(entry);
        }
      }
    }
    catalogs = files;
    for (const catalog of dirtyCatalogs) {
      if (!files.includes(catalog)) dirtyCatalogs.delete(catalog);
    }
    $('export-xml').hidden = !catalogs.length;
    translations = index;
    xmlVariants = variants;
    const options = [...languages];
    language = languages.has(preferred) ? preferred
      : options.find(value => /^(español|spanish)/i.test(value)) ?? options[0] ?? '';
    const picker = $('language-picker');
    picker.hidden = !options.length;
    picker.replaceChildren(...options.map(value => {
      const option = element('option', '', value);
      option.value = value;
      return option;
    }));
    picker.value = language;
  }

  function sourceEntries(file) {
    if (!file || typeof file.filename !== 'string' || typeof file.source !== 'string' || file.source.length > 2_000_000) {
      throw new Error('La fuente de texto C# no es válida.');
    }
    if (!indexedSources.has(file)) indexedSources.set(file, CSharpDialogue.localizationIndex(file.source));
    return indexedSources.get(file);
  }

  function setTextSources(helpers) {
    const index = new Map();
    for (const file of [...opened.map(item => item.csharp).filter(Boolean), ...helpers]) {
      for (const entry of sourceEntries(file)) {
        const key = entry.name + ':' + (entry.arity ?? 'field');
        for (const name of [entry.owner + '.' + key, key]) {
          if (!index.has(name)) index.set(name, []);
          index.get(name).push(entry);
        }
      }
    }
    textSources = helpers;
    textMembers = index;
  }

  function openDocuments(files, xml = [], active = 0, helpers = [], preferred = '') {
    opened = files;
    setCatalogs(xml, preferred);
    setTextSources(helpers);
    dirtyProjects.clear();
    load(files[active] ?? files[0]);
  }

  function replaceProject(action) {
    if (dirtyProjects.size || dirtyCatalogs.size) confirmAction('Cambiar de proyecto', 'Se perderán los cambios sin guardar del proyecto actual.', action);
    else action();
  }

  board.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    suppressClick = false;
    const head = event.target.closest('.node-head');
    if (head && connecting) return;
    if (!head && event.target !== board) return;
    const card = head?.closest('.node');
    const state = card ? findState(card.dataset.state) : null;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y,
      state, card, startX: state?.x, startY: state?.y, moved: false };
  });

  board.addEventListener('pointermove', event => {
    if (connecting) {
      const rect = board.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      draw();
    }
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) {
      board.setPointerCapture(event.pointerId);
      board.classList.add('is-dragging');
      drag.moved = true;
    }
    if (drag.state) {
      drag.state.x = clamp(Math.round(drag.startX + dx / camera.scale), -999_000, 999_000);
      drag.state.y = clamp(Math.round(drag.startY + dy / camera.scale), -999_000, 999_000);
      drag.card.style.left = `${drag.state.x}px`;
      drag.card.style.top = `${drag.state.y}px`;
    } else {
      camera.x = drag.cameraX + dx;
      camera.y = drag.cameraY + dy;
      stage.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
    }
    draw();
  });

  function finishDrag(event) {
    if (drag?.id !== event.pointerId) return;
    suppressClick = drag.moved;
    if (drag.moved && drag.state) { dirtyProjects.add(project); metadata(); }
    drag = null;
    board.classList.remove('is-dragging');
  }
  board.addEventListener('pointerup', finishDrag);
  board.addEventListener('pointercancel', finishDrag);
  board.addEventListener('pointerleave', () => { if (drag && !drag.moved) drag = null; });
  board.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.stopPropagation();
  }, true);
  board.addEventListener('wheel', event => {
    if (event.target.closest('button') && !event.ctrlKey) return;
    event.preventDefault();
    const rect = board.getBoundingClientRect();
    zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !connecting || modal.open) return;
    connecting = null;
    renderGraph();
  });
  window.addEventListener('beforeunload', event => {
    if (!dirtyProjects.size && !dirtyCatalogs.size) return;
    event.preventDefault();
    event.returnValue = true;
  });
  $('project-name').addEventListener('input', event => { project.name = event.target.value; dirtyProjects.add(project); metadata(); });
  $('source-picker').addEventListener('change', event => load(opened[Number(event.target.value)]));
  $('language-picker').addEventListener('change', event => {
    language = event.target.value;
    renderGraph();
    renderInspector();
  });
  $('new-project').addEventListener('click', () => replaceProject(() => openDocuments([DialogueProject.fresh()])));
  $('load-demo').addEventListener('click', () => replaceProject(() => openDocuments([DialogueProject.demo()])));
  $('open-project').addEventListener('click', () => $('project-file').click());
  $('project-file').addEventListener('change', async event => {
    const input = event.target;
    const files = [...input.files];
    input.value = '';
    if (!files.length) return;
    try {
      if (files.length > 350 || files.reduce((size, file) => size + file.size, 0) > 90_000_000) throw new Error('La selección supera el tamaño admitido.');
      if (files.some(file => /\.json$/i.test(file.name))) {
        if (files.length !== 1) throw new Error('Abre el proyecto JSON de forma individual.');
        const source = await files[0].text();
        const data = JSON.parse(source);
        if (data?.workspace === 1) {
          if (!Array.isArray(data.projects) || !data.projects.length || data.projects.length > 350 || !Array.isArray(data.catalogs)
            || !Number.isInteger(data.active) || (data.textSources !== undefined && !Array.isArray(data.textSources))) {
            throw new Error('El espacio de trabajo JSON no es válido.');
          }
          const projects = data.projects.map(item => DialogueProject.importProject(JSON.stringify(item)));
          const helpers = data.textSources ?? [];
          data.catalogs.forEach(catalogEntries);
          helpers.forEach(sourceEntries);
          replaceProject(() => {
            openDocuments(projects, data.catalogs, data.active, helpers, data.language);
            notice('Proyecto abierto.');
          });
        } else {
          const data = DialogueProject.importProject(source);
          replaceProject(() => { openDocuments([data]); notice('Proyecto abierto.'); });
        }
        return;
      }
      const projects = [];
      const xml = [];
      const helpers = [];
      const warnings = [];
      for (const file of files) {
        try {
          if (/\.xml$/i.test(file.name)) {
            if (file.size > 3_000_000) throw new Error('El catálogo XML supera el tamaño admitido.');
            const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
            const catalog = { filename: file.name, source };
            if (/^language_data\.xml$/i.test(file.name)
              && new DOMParser().parseFromString(catalog.source, 'application/xml').documentElement.localName === 'LanguageData') continue;
            catalogEntries(catalog);
            xml.push(catalog);
          } else if (/\.cs$/i.test(file.name)) {
            if (file.size > 2_000_000) throw new Error('El archivo C# supera el tamaño admitido.');
            const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
            const fileSource = { filename: file.name, source };
            try {
              const data = CSharpDialogue.importFile(source, file.name);
              projects.push(data);
              warnings.push(...CSharpDialogue.registrations(data.csharp).warnings.map(message => file.name + ' · ' + message));
            } catch (error) {
              if (!/No se encontraron registros/.test(error.message)
                || !sourceEntries(fileSource).some(entry => entry.reference.id || entry.reference.fallback)) throw error;
              helpers.push(fileSource);
            }
          } else {
            throw new Error('Formato compatible: .cs, .json o .xml.');
          }
        } catch (error) {
          if (!/No se encontraron registros/.test(error.message) || files.length === 1) warnings.push(file.name + ' · ' + error.message);
        }
      }
      if (!projects.length && !xml.length && !helpers.length) throw new Error(warnings[0] || 'No se encontraron registros de diálogo ni catálogos XML.');
      const mergedHelpers = [...new Map([...textSources, ...helpers].map(file => [file.filename, file])).values()];
      function report() {
        const loaded = [];
        if (projects.length) loaded.push(projects.length === 1 ? '1 archivo C#' : projects.length + ' archivos C#');
        if (xml.length) loaded.push(xml.length === 1 ? '1 catálogo XML' : xml.length + ' catálogos XML');
        if (helpers.length) loaded.push(helpers.length === 1 ? '1 fuente de texto C#' : helpers.length + ' fuentes de texto C#');
        const summary = loaded.join(' · ');
        if (!warnings.length) { notice(summary); return; }
        const list = element('ul', 'error-list');
        list.append(...warnings.map(message => element('li', '', message)));
        openModal('Importación parcial', element('p', '', summary), list);
      }
      if (projects.length) {
        replaceProject(() => { openDocuments(projects, xml.length ? xml : catalogs, 0, mergedHelpers, language); report(); });
      } else {
        const filesByName = new Map([...catalogs, ...xml].map(catalog => [catalogKey(catalog), catalog]));
        const replacesEdits = [...dirtyCatalogs].some(catalog => filesByName.get(catalogKey(catalog)) !== catalog);
        const apply = () => {
          setCatalogs([...filesByName.values()]);
          setTextSources(mergedHelpers);
          dirtyProjects.add(project);
          metadata();
          renderGraph();
          renderInspector();
          report();
        };
        if (replacesEdits) confirmAction('Reemplazar catálogo', 'Se perderán las traducciones sin guardar de los catálogos reemplazados.', apply);
        else apply();
      }
    } catch (error) {
      const detail = error instanceof SyntaxError ? 'El archivo no contiene JSON válido.' : error.message;
      openModal('No se pudo abrir el proyecto', element('p', '', detail));
    }
  });
  $('save-project').addEventListener('click', () => {
    const data = opened.length > 1 || catalogs.length || textSources.length
      ? { workspace: 1, projects: opened, catalogs: catalogs.map(catalog => ({
        filename: catalog.filename, source: LocalizationCatalog.generate(catalog),
      })), textSources, language, active: opened.indexOf(project) } : project;
    download(`${JSON.stringify(data, null, 2)}\n`, 'application/json', `${fileName()}.json`);
    dirtyProjects.clear();
    dirtyCatalogs.clear();
    metadata();
    notice('Proyecto guardado como JSON.');
  });
  $('export-xml').addEventListener('click', exportXml);
  $('export-code').addEventListener('click', exportCode);
  $('play-dialogue').addEventListener('click', play);
  $('validation-button').addEventListener('click', showValidation);
  $('close-modal').addEventListener('click', () => modal.close());
  $('add-state').addEventListener('click', () => addState(false));
  $('add-exit').addEventListener('click', () => addState(true));
  $('zoom-out').addEventListener('click', () => zoom(1 / 1.2));
  $('zoom-in').addEventListener('click', () => zoom(1.2));
  $('fit').addEventListener('click', fit);
  new ResizeObserver(draw).observe(board);
  load(project);
})();
