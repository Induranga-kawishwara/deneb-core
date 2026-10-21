const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ui = require('../packages/deneb-ui/dist');
const { SiteDataContext } = require('../packages/deneb-ui/dist/SiteDataProvider');
const roots = ['templates/nextjs', 'packages/create-template/template'];
const fields = ['directInformationTitle', 'nameLabel', 'emailLabel', 'messageLabel'];

for (const root of roots) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', root, 'src/app/contact/page.tsx'), 'utf8');
  test(`${root}: schema, provider text, styles and empty editing targets`, () => {
    const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', root, 'src/data/site-data.json'), 'utf8'));
    const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', root, 'fivora-template.json'), 'utf8'));
    const section = schema.editorSchema.sections.find(s => s.path === 'contact');
    for (const field of fields) {
      assert.equal(typeof data.content.contact[field], 'string');
      assert.ok(section.fields.some(f => f.key === field && f.type === 'text'));
    }
    const module = { exports: {} };
    vm.runInNewContext(ts.transpile(source, {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}), {
      exports: module.exports,
      require: name => name === '@/lib/siteDataContext' ? ui : require(name),
    });
    const Page = module.exports.default;
    function render(contact) {
      return renderToStaticMarkup(React.createElement(SiteDataContext.Provider,
        {value: {...data, content: {...data.content, contact}}}, React.createElement(Page)));
    }
    const contact = {...data.content.contact};
    for (const field of fields) contact[field] = `Edited ${field}`;
    const html = render(contact);
    for (const field of fields) {
      assert.ok(html.includes(`Edited ${field}`));
      assert.ok(html.includes(`data-preview-field-path="contact.${field}"`));
      assert.ok(html.includes(`data-preview-style-target="contact.${field}"`));
    }
    assert.ok(!html.includes('data-preview-static="contact-heading"'));
    assert.match(html, /<label><span[^>]*contact.nameLabel/);
    for (const field of fields) contact[field] = '';
    const empty = render(contact);
    for (const field of fields) assert.ok(empty.includes(`data-preview-field-path="contact.${field}"`));
  });

  test(`${root}: contact submission still posts visitor values and resets`, async () => {
    const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let handler;
    function visit(node) {
      if (ts.isFunctionDeclaration(node) && node.name?.text === 'handleSubmit') handler = node.getText(ast);
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(handler);
    let request, status, reset = false, prevented = false;
    const context = {
      siteData: {project: {id: 'project-1'}}, setStatus: value => { status = value; },
      FormData: class {get(key) { return {name: 'Visitor', email: 'visitor@example.com', message: 'Hello'}[key]; }},
      fetch: async (url, options) => { request = {url, ...options}; return {ok: true}; },
    };
    vm.createContext(context);
    vm.runInContext(ts.transpile(handler, {target: ts.ScriptTarget.ES2020}), context);
    await context.handleSubmit({preventDefault() { prevented = true; }, currentTarget: {reset() {reset = true; }}});
    assert.ok(prevented && reset);
    assert.equal(request.url, '/site-contact');
    assert.equal(request.method, 'POST');
    assert.deepEqual(JSON.parse(request.body), {projectId: 'project-1', name: 'Visitor', email: 'visitor@example.com', message: 'Hello'});
    assert.ok(status.includes('sent successfully'));
  });
}
