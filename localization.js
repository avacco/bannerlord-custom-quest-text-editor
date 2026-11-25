'use strict';

// Antes de que venga algún intelectual, *sí*, esto fue generado por IA. Creo que fue Opus 5.5. Ya ni me acuerdo.
// Osea, mira esta maraña, viejo. Ni aunque lo intente voy a entenderlo.

const LocalizationCatalog = (() => {
  const sourceLimit = 3_000_000;
  const cache = new WeakMap();
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const forbidden = /[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u;

  function unpack(value) {
    return value.replace(/\r\n|[\r\n\t]/g, ' ').replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);/g, (_, entity) => {
      if (entity[0] !== '#') return entities[entity];
      return String.fromCodePoint(entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
    });
  }

  function pack(value, quote) {
    const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\n': '&#10;', '\r': '&#13;', '\t': '&#9;' };
    escapes[quote] = quote === '"' ? '&quot;' : '&apos;';
    return value.replace(/[&<>"'\r\n\t]/g, char => escapes[char] ?? char);
  }

  function locate(source) {
    const rows = [];
    const tags = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<([\w:.-]+)((?:[^<>"']|"[^"]*"|'[^']*')*)>/gu;
    for (const tag of source.matchAll(tags)) {
      const name = tag[1];
      if (!name || !['string', 'text'].includes(name.split(':').at(-1))) continue;
      const attrs = new Map();
      for (const attr of tag[2].matchAll(/([^\s=]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
        const end = tag.index + 1 + name.length + attr.index + attr[0].length - 1;
        attrs.set(attr[1], { start: end - attr[3].length, end, quote: attr[2], value: unpack(attr[3]) });
      }
      if (attrs.has('id') && attrs.has('text')) {
        rows.push({ name, id: attrs.get('id').value, span: attrs.get('text') });
      }
    }
    return rows;
  }

  function parse(catalog) {
    if (!catalog || typeof catalog.filename !== 'string' || typeof catalog.source !== 'string'
      || catalog.source.length > sourceLimit || /<!DOCTYPE/i.test(catalog.source)) throw new Error('El catálogo XML no es válido.');
    const doc = new DOMParser().parseFromString(catalog.source, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('«' + catalog.filename + '» contiene XML inválido.');
    const rows = [...doc.querySelectorAll('string[id][text], text[id][text]')];
    if (!rows.length) throw new Error('«' + catalog.filename + '» no contiene entradas de texto reconocibles.');
    const language = doc.querySelector('tags > tag[language]')?.getAttribute('language')?.trim() ?? '';
    const spans = locate(catalog.source);
    const matched = rows.length === spans.length && rows.every((node, index) =>
      node.tagName === spans[index].name && node.getAttribute('id') === spans[index].id && node.getAttribute('text') === spans[index].span.value);
    let size = catalog.source.length;
    const entries = rows.map((node, index) => {
      const id = node.getAttribute('id');
      const original = node.getAttribute('text');
      const span = matched ? spans[index].span : null;
      let text = original;
      let length = span ? span.end - span.start : 0;
      return {
        id, original, span, catalog, language, filename: catalog.filename,
        get text() { return text; },
        update(value) {
          if (!span) throw new Error('No se pudo ubicar el atributo de texto en el XML original.');
          if (forbidden.test(value)) throw new Error('El texto contiene un carácter que XML no admite.');
          const nextLength = value === original ? span.end - span.start : pack(value, span.quote).length;
          const nextSize = size + nextLength - length;
          if (nextSize > sourceLimit) throw new Error('El cambio supera el tamaño admitido para un catálogo XML.');
          size = nextSize;
          length = nextLength;
          text = value;
        },
      };
    });
    return { language, entries };
  }

  function read(catalog) {
    if (!cache.has(catalog)) cache.set(catalog, parse(catalog));
    return cache.get(catalog);
  }

  function generate(catalog) {
    let cursor = 0;
    const parts = [];
    for (const entry of read(catalog).entries) {
      if (entry.text === entry.original) continue;
      const { start, end, quote } = entry.span;
      parts.push(catalog.source.slice(cursor, start), pack(entry.text, quote));
      cursor = end;
    }
    parts.push(catalog.source.slice(cursor));
    return parts.join('');
  }

  return { read, generate };
})();
