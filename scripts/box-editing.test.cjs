const {test} = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const {EditableBox} = require('../packages/deneb-ui/dist/EditableBox');
const {SiteDataContext} = require('../packages/deneb-ui/dist/SiteDataProvider');
const {patchElementStyle, getLiveStyleCache} = require('../packages/deneb-core/dist/engine/domPatcher');

test('box loads saved background, independent padding, margins and gap', () => {
  const html = renderToStaticMarkup(React.createElement(SiteDataContext.Provider, {value: {
    styles: {'contact.informationCard': {backgroundColor:'#123456',paddingTop:0,paddingBottom:12,
      paddingLeft:18,paddingRight:24,marginTop:8,spacingBottom:16,gap:20}},
  }}, React.createElement(EditableBox, {stylePath:'contact.informationCard',className:'card contact-details',radius:'xl'}, 'Content')));
  for (const expected of ['data-preview-style-target="contact.informationCard"','data-preview-style-type="card"',
    '--deneb-card-bg:#123456','--deneb-card-pt:0px','--deneb-card-pb:12px','--deneb-card-pl:18px',
    '--deneb-card-pr:24px','--deneb-card-margin-top:8px','--deneb-card-margin-bottom:16px',
    '--deneb-card-gap:20px','padding-top:var(--deneb-card-pt)']) assert.ok(html.includes(expected),expected);
  assert.ok(!html.includes('data-preview-field-path='));
});

test('unedited box retains class defaults and existing props', () => {
  const html = renderToStaticMarkup(React.createElement(SiteDataContext.Provider,{value:{}},
    React.createElement(EditableBox,{stylePath:'contact.formCard',className:'card',radius:'xl'},'Form')));
  assert.ok(html.includes('border-radius:16px'));
  assert.ok(!html.includes('padding-top:'));
  assert.ok(!html.includes('background-color:'));
});

test('live card patches preserve independent edges, zero spacing and accumulated edits', () => {
  getLiveStyleCache().clear();
  const styles = new Map();
  const element = {
    getAttribute: name => name === 'data-preview-style-target' ? 'contact.informationCard' : 'card',
    style: {setProperty:(name,value)=>styles.set(name,value),removeProperty:name=>styles.delete(name)},
    setAttribute() {},
  };
  patchElementStyle(element,'card',{paddingTop:0,paddingBottom:12,paddingLeft:18,paddingRight:24,gap:20,spacingTop:8});
  assert.equal(styles.get('padding-top'),'0px');
  assert.equal(styles.get('padding-bottom'),'12px');
  assert.equal(styles.get('padding-left'),'18px');
  assert.equal(styles.get('padding-right'),'24px');
  assert.equal(styles.has('padding'),false);
  assert.equal(styles.get('gap'),'20px');
  assert.equal(styles.get('margin-top'),'8px');
  patchElementStyle(element,'card',{backgroundColor:'#123456'});
  assert.equal(styles.get('background-color'),'#123456');
  assert.equal(styles.get('padding-top'),'0px');
});
