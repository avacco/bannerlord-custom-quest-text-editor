'use strict';

// Antes de que venga algún intelectual, *sí*, esto fue generado por IA. Creo que fue Opus 5.5. Ya ni me acuerdo.
// Osea, mira esta maraña, viejo. Ni aunque lo intente voy a entenderlo.

const DialogueProject = (() => {
  const tokenPattern = /^[A-Za-z0-9_.-]+$/;
  const callbackPattern = /^(?:@?[A-Za-z_][A-Za-z0-9_]*\.)*@?[A-Za-z_][A-Za-z0-9_]*$/;
  const keywords = new Set('abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while'.split(' '));

  function validCallback(value) {
    if (!callbackPattern.test(value)) return false;
    const parts = value.split('.');
    return parts.every((part, index) => !keywords.has(part)
      || (index === 0 && parts.length > 1 && ['this', 'base'].includes(part)));
  }

  function fresh() {
    return {
      version: 1,
      name: 'Nuevo diálogo',
      entry: 'entry',
      states: [
        { id: 'entry', title: 'Inicio', token: 'start', x: 0, y: 0, external: false },
        { id: 'end', title: 'Cerrar conversación', token: 'close_window', x: 305, y: 0, external: true },
      ],
      lines: [],
    };
  }

  function demo() {
    const states = [
      ['entry', 'Saludo del vigía', 'forge_demo_lookout', 0, 126],
      ['options', 'Responder al vigía', 'forge_demo_options', 290, 126],
      ['route', 'Camino al mirador', 'forge_demo_route', 586, 0],
      ['passage', 'Paso al mirador', 'forge_demo_passage', 586, 238],
      ['exit', 'Cerrar conversación', 'close_window', 875, 270, true],
    ].map(([id, title, token, x, y, external = false]) => ({ id, title, token, x, y, external }));

    const lines = [
      ['entry', 'npc', 'options', 'greeting', 'El mirador está abierto. Si subes ahora, aún verás la luz sobre los dos puentes.'],
      ['options', 'player', 'route', 'ask_route', '¿Por dónde se sube al mirador?'],
      ['options', 'player', 'passage', 'accept', 'Subiré ahora.'],
      ['options', 'player', 'exit', 'leave', 'Volveré otro día.'],
      ['route', 'npc', 'options', 'directions', 'Sigue las marcas blancas hasta la escalera de piedra. El último tramo está a la sombra.'],
      ['passage', 'npc', 'exit', 'farewell', 'Adelante. Cierra la verja al pasar, así el viento no la golpea.'],
    ].map(([source, speaker, destination, name, text]) => ({
      id: name, source, speaker, destination, key: `forge_demo_line_${name}`, localization: `forge_demo_text_${name}`,
      text, condition: '', consequence: '', priority: '100',
    }));
    return { version: 1, name: 'El mirador del valle', entry: 'entry', states, lines };
  }

  function importProject(text) {
    const data = JSON.parse(text);
    const string = (value, max) => typeof value === 'string' && value.length <= max;
    const position = value => Number.isFinite(value) && Math.abs(value) <= 1_000_000;
    const id = value => string(value, 120) && Boolean(value);
    const arrays = data && Array.isArray(data.states) && Array.isArray(data.lines);
    if (!arrays || data.version !== 1 || !string(data.name, 100) || !string(data.entry, 120)
      || data.states.length > 250 || data.lines.length > 1000) {
      throw new Error('El archivo no tiene el formato de proyecto de Forja de diálogos.');
    }
    let csharp;
    let registrations;
    if (data.csharp !== undefined) {
      const { filename, source, parser } = data.csharp ?? {};
      if (!string(filename, 300) || !/\.cs$/i.test(filename) || !string(source, 2_000_000)) {
        throw new Error('El proyecto contiene datos de origen C# inválidos.');
      }
      csharp = { filename, source };
      if (parser === 2) csharp.parser = parser;
      registrations = CSharpDialogue.registrations(csharp).slots;
      if (!registrations.length) throw new Error('El origen C# ya no contiene registros compatibles.');
    }
    const stateIds = new Set();
    const states = data.states.map(state => {
      if (!state || !id(state.id) || stateIds.has(state.id) || !string(state.title, 100)
        || !string(state.token, 180) || !position(state.x) || !position(state.y) || typeof state.external !== 'boolean') {
        throw new Error('El proyecto contiene un estado inválido o duplicado.');
      }
      stateIds.add(state.id);
      const { id: stateId, title, token, x, y, external } = state;
      return { id: stateId, title, token, x, y, external };
    });
    const lineIds = new Set();
    const lines = data.lines.map(line => {
      if (!line || !id(line.id) || lineIds.has(line.id) || !stateIds.has(line.source)
        || !['player', 'npc'].includes(line.speaker) || !string(line.destination, 120)
        || !string(line.key, 180) || !string(line.localization, 180) || !string(line.text, 10000)
        || !string(line.condition, csharp ? 4096 : 240) || !string(line.consequence, csharp ? 4096 : 240) || !string(line.priority, 12)) {
        throw new Error('El proyecto contiene una línea inválida o duplicada.');
      }
      lineIds.add(line.id);
      const { id: lineId, source, speaker, destination, key, localization, text, condition, consequence, priority } = line;
      const result = { id: lineId, source, speaker, destination, key, localization, text, condition, consequence, priority };
      if (csharp) {
        const { slot } = line;
        if (!Number.isInteger(slot) || !registrations[slot]) {
          throw new Error('Una línea hace referencia a un registro C# desconocido.');
        }
        result.slot = slot;
        if (csharp.parser === 2) {
          if (line.computedText === true) result.computedText = true;
          if (line.repeat === true) result.repeat = true;
        }
        for (const property of ['clickable', 'persuasion', 'listener', 'speakerCallback']) {
          const value = line[property] ?? '';
          if (!string(value, 4096)) throw new Error('El proyecto contiene una expresión C# que no se puede leer.');
          result[property] = value;
        }
      }
      return result;
    });
    const project = { version: 1, name: data.name, entry: data.entry, states, lines };
    if (csharp) project.csharp = csharp;
    return project;
  }

  function validate(project) {
    const errors = [];
    const warnings = [];
    const states = new Map(project.states.map(state => [state.id, state]));
    const bySource = new Map(project.states.map(state => [state.id, []]));
    const tokens = new Set();
    const keys = new Set();
    const registration = project.csharp ? CSharpDialogue.registrations(project.csharp) : null;
    if (registration) warnings.push(...registration.warnings);
    const entry = states.get(project.entry);
    if (!entry || entry.external) errors.push('Selecciona un estado de inicio.');
    if (!project.lines.length) errors.push('Añade al menos una línea de diálogo.');

    for (const state of project.states) {
      const title = state.title.trim() || state.id;
      if (!(project.csharp?.parser === 2 ? /^[A-Za-z0-9_.$:-]+$/ : tokenPattern).test(state.token)) errors.push(`«${title}» necesita un token válido, sin espacios.`);
      else if (tokens.has(state.token)) errors.push(`El token «${state.token}» está repetido.`);
      tokens.add(state.token);
    }

    for (const line of project.lines) {
      const label = line.key || states.get(line.source)?.title || 'Línea sin ID';
      const source = states.get(line.source);
      const slot = registration?.slots[line.slot];
      if (!source || source.external) errors.push(`«${label}» necesita un estado de origen interno.`);
      bySource.get(line.source)?.push(line);
      if (!states.has(line.destination)) errors.push(`«${label}» necesita un destino.`);
      const localized = line.localization && line.localization !== '!';
      if (!line.text.trim() && !localized && !(project.csharp?.parser === 2 && line.consequence)) errors.push(`«${label}» necesita texto o una clave de traducción.`);
      if (slot?.kind !== 'flow' && !slot?.template) {
        if (!tokenPattern.test(line.key)) errors.push(`«${label}» necesita un ID de línea válido, sin espacios.`);
        else if (keys.has(line.key)) errors.push(`El ID de línea «${line.key}» está repetido.`);
        keys.add(line.key);
      }
      if (line.localization && line.localization !== '!' && !tokenPattern.test(line.localization)) errors.push(`«${label}» tiene una clave de traducción inválida.`);
      if (registration) {
        if (!slot) errors.push(`«${label}» necesita un registro C# de origen.`);
        if (line.persuasion && (slot?.kind !== 'flat' || line.speaker !== 'player' || line.repeat)) errors.push(`«${label}» requiere una opción del jugador de CampaignGameStarter para la persuasión.`);
        if (line.speakerCallback && line.speaker === 'player') errors.push(`«${label}» solo admite el delegado del hablante en una línea de PNJ.`);
        for (const property of ['condition', 'consequence', 'clickable', 'persuasion', 'listener', 'speakerCallback']) {
          if (!CSharpDialogue.expressionIsBalanced(line[property])) errors.push(`«${label}» tiene una expresión C# incompleta.`);
        }
      } else {
        if (line.condition && !validCallback(line.condition)) errors.push(`«${label}» necesita un nombre de método válido como condición.`);
        if (line.consequence && !validCallback(line.consequence)) errors.push(`«${label}» necesita un nombre de método válido como consecuencia.`);
      }
      if (!/^-?\d+$/.test(line.priority) || Number(line.priority) < -2147483648 || Number(line.priority) > 2147483647) {
        errors.push(`«${label}» necesita una prioridad entera de 32 bits.`);
      }
    }

    const visited = new Set();
    const pending = entry ? [entry.id] : [];
    while (pending.length) {
      const id = pending.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      for (const line of bySource.get(id) ?? []) {
        if (states.has(line.destination)) pending.push(line.destination);
      }
    }
    for (const state of project.states) {
      const lines = bySource.get(state.id);
      if (!visited.has(state.id)) warnings.push(`No se llega a «${state.title || state.token}» desde el inicio de la vista previa.`);
      if (!state.external && !lines.length && visited.has(state.id)) errors.push(`Añade una línea a «${state.title || state.token}».`);
      if (new Set(lines.map(line => line.speaker)).size > 1) warnings.push(`«${state.title || state.token}» mezcla líneas de PNJ y del jugador.`);
    }
    return { errors, warnings };
  }

  function csharpString(value) {
    return JSON.stringify(value).replace(/[\u007f-\u009f\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  }

  function generate(project) {
    const { errors } = validate(project);
    if (errors.length) throw new Error(errors[0]);
    if (project.csharp) return CSharpDialogue.exportFile(project, csharpString);
    const tokens = new Map(project.states.map(state => [state.id, state.token]));
    const calls = project.lines.map(line => {
      const method = line.speaker === 'player' ? 'AddPlayerLine' : 'AddDialogLine';
      const text = line.localization ? `{=${line.localization}}${line.text}` : line.text;
      const args = [line.key, tokens.get(line.source), tokens.get(line.destination), text].map(csharpString);
      args.push(line.condition || 'null', line.consequence || 'null');
      if (Number(line.priority) !== 100) args.push(String(Number(line.priority)));
      return `    starter.${method}(\n        ${args.join(',\n        ')});`;
    });
    return `private void AddDialogs(CampaignGameStarter starter)\n{\n${calls.join('\n\n')}\n}\n`;
  }

  return { fresh, demo, importProject, validate, generate };
})();
