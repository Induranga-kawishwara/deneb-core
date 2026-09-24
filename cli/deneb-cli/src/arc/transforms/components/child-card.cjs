'use strict';

const recast = require('recast');
const {
  getJsxName,
  findJsxAttribute,
  hasJsxAttribute,
  jsxTemplatePathAttr,
  b,
} = require('../../ast.cjs');

function instrumentChildCardComponent(ast, transform, isTypeScript = false) {
  const componentName = transform.componentName;
  const listPath = transform.listField || transform.listPath || '';
  if (!componentName) return false;

  let instrumented = false;

  function updateTsInterface(rootAst, interfaceName) {
    recast.types.visit(rootAst, {
      visitTSInterfaceDeclaration(pathNode) {
        if (pathNode.node.id?.name === interfaceName) {
          const body = pathNode.node.body?.body || [];
          if (!body.some((prop) => prop.key?.name === 'previewItemPath')) {
            const sig1 = b.tsPropertySignature(b.identifier('previewItemPath'), b.tsTypeAnnotation(b.tsStringKeyword()));
            sig1.optional = true;
            body.push(sig1);
            instrumented = true;
          }
          if (!body.some((prop) => prop.key?.name === 'index')) {
            const sig2 = b.tsPropertySignature(b.identifier('index'), b.tsTypeAnnotation(b.tsNumberKeyword()));
            sig2.optional = true;
            body.push(sig2);
            instrumented = true;
          }
        }
        this.traverse(pathNode);
      },
      visitTSTypeAliasDeclaration(pathNode) {
        if (pathNode.node.id?.name === interfaceName && pathNode.node.typeAnnotation?.type === 'TSTypeLiteral') {
          const members = pathNode.node.typeAnnotation.members || [];
          if (!members.some((m) => m.key?.name === 'previewItemPath')) {
            const sig1 = b.tsPropertySignature(b.identifier('previewItemPath'), b.tsTypeAnnotation(b.tsStringKeyword()));
            sig1.optional = true;
            members.push(sig1);
            instrumented = true;
          }
          if (!members.some((m) => m.key?.name === 'index')) {
            const sig2 = b.tsPropertySignature(b.identifier('index'), b.tsTypeAnnotation(b.tsNumberKeyword()));
            sig2.optional = true;
            members.push(sig2);
            instrumented = true;
          }
        }
        this.traverse(pathNode);
      },
    });
  }

  function instrumentFunctionProps(fnNode, isTs) {
    let changed = false;
    let params = fnNode.params || [];
    if (!params.length) {
      fnNode.params = [
        b.objectPattern([
          b.property('init', b.identifier('previewItemPath'), b.identifier('previewItemPath')),
          b.property('init', b.identifier('index'), b.identifier('index')),
        ]),
      ];
      changed = true;
    } else {
      const firstParam = params[0];
      if (firstParam.type === 'ObjectPattern') {
        const hasPreviewPath = firstParam.properties.some(
          (p) => p.key?.name === 'previewItemPath' || p.argument?.name === 'previewItemPath'
        );
        if (!hasPreviewPath) {
          const prop = b.property('init', b.identifier('previewItemPath'), b.identifier('previewItemPath'));
          prop.shorthand = true;
          firstParam.properties.push(prop);
          changed = true;
        }
        const hasIndex = firstParam.properties.some(
          (p) => p.key?.name === 'index' || p.argument?.name === 'index'
        );
        if (!hasIndex) {
          const prop = b.property('init', b.identifier('index'), b.identifier('index'));
          prop.shorthand = true;
          firstParam.properties.push(prop);
          changed = true;
        }

        if (isTs && firstParam.typeAnnotation?.typeAnnotation) {
          const typeAnn = firstParam.typeAnnotation.typeAnnotation;
          if (typeAnn.type === 'TSTypeReference' && typeAnn.typeName?.name) {
            updateTsInterface(ast, typeAnn.typeName.name);
          }
        }
      } else if (firstParam.type === 'Identifier') {
        const paramName = firstParam.name;
        if (isTs && firstParam.typeAnnotation?.typeAnnotation) {
          const typeAnn = firstParam.typeAnnotation.typeAnnotation;
          if (typeAnn.type === 'TSTypeReference' && typeAnn.typeName?.name) {
            updateTsInterface(ast, typeAnn.typeName.name);
          }
        }
        recast.types.visit(fnNode.body || fnNode, {
          visitVariableDeclarator(vPath) {
            if (vPath.node.id?.type === 'ObjectPattern' && vPath.node.init?.name === paramName) {
              const propsList = vPath.node.id.properties;
              if (!propsList.some((p) => p.key?.name === 'previewItemPath')) {
                const prop = b.property('init', b.identifier('previewItemPath'), b.identifier('previewItemPath'));
                prop.shorthand = true;
                propsList.push(prop);
                changed = true;
              }
              if (!propsList.some((p) => p.key?.name === 'index')) {
                const prop = b.property('init', b.identifier('index'), b.identifier('index'));
                prop.shorthand = true;
                propsList.push(prop);
                changed = true;
              }
            }
            this.traverse(vPath);
          },
        });
      }
    }
    return changed;
  }

  recast.types.visit(ast, {
    visitFunctionDeclaration(pathNode) {
      if (pathNode.node.id?.name === componentName) {
        if (instrumentFunctionProps(pathNode.node, isTypeScript)) instrumented = true;
      }
      this.traverse(pathNode);
    },
    visitVariableDeclarator(pathNode) {
      if (pathNode.node.id?.name === componentName) {
        const init = pathNode.node.init;
        if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
          if (instrumentFunctionProps(init, isTypeScript)) instrumented = true;
        }
      }
      this.traverse(pathNode);
    },
    visitExportDefaultDeclaration(pathNode) {
      const decl = pathNode.node.declaration;
      if (decl && (decl.type === 'FunctionDeclaration' || decl.type === 'ArrowFunctionExpression' || decl.type === 'FunctionExpression')) {
        const fnName = decl.id?.name;
        if (!fnName || fnName === componentName) {
          if (instrumentFunctionProps(decl, isTypeScript)) instrumented = true;
        }
      }
      this.traverse(pathNode);
    },
  });

  let rootElement = null;
  recast.types.visit(ast, {
    visitReturnStatement(pathNode) {
      if (!rootElement && pathNode.node.argument) {
        let arg = pathNode.node.argument;
        if (arg.type === 'ParenthesizedExpression') arg = arg.expression;
        if (arg.type === 'JSXElement') {
          rootElement = arg;
        }
      }
      this.traverse(pathNode);
    },
  });

  if (rootElement) {
    if (!hasJsxAttribute(rootElement, 'data-preview-item-path')) {
      if (listPath) {
        rootElement.openingElement.attributes.push(
          jsxTemplatePathAttr('data-preview-item-path', listPath, 'index')
        );
      } else {
        rootElement.openingElement.attributes.push(
          b.jsxAttribute(
            b.jsxIdentifier('data-preview-item-path'),
            b.jsxExpressionContainer(b.identifier('previewItemPath'))
          )
        );
      }
      instrumented = true;
    }
  }

  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      const node = pathNode.node;
      const tagName = getJsxName(node);

      const srcAttr = findJsxAttribute(node, 'src');
      if (srcAttr && (tagName === 'img' || tagName === 'Image') && !hasJsxAttribute(node, 'data-preview-field-path')) {
        const rawCode = recast.print(srcAttr.value).code;
        if (/image|photo|avatar|thumb|img|src/i.test(rawCode)) {
          const imgField = (transform.itemFields || []).find((f) => f.type === 'image' || /image|photo/i.test(f.key))?.key || 'image';
          if (listPath) {
            node.openingElement.attributes.push(
              jsxTemplatePathAttr('data-preview-field-path', listPath, 'index', `.${imgField}`)
            );
          } else {
            node.openingElement.attributes.push(
              b.jsxAttribute(
                b.jsxIdentifier('data-preview-field-path'),
                b.jsxExpressionContainer(
                  b.templateLiteral(
                    [
                      b.templateElement({ raw: '', cooked: '' }, false),
                      b.templateElement({ raw: `.${imgField}`, cooked: `.${imgField}` }, true),
                    ],
                    [b.identifier('previewItemPath')]
                  )
                )
              )
            );
          }
          instrumented = true;
        }
      }

      for (const child of node.children || []) {
        if (child.type === 'JSXExpressionContainer' && child.expression) {
          const exprCode = recast.print(child.expression).code;
          const candidateField = (transform.itemFields || []).find(
            (f) => exprCode.includes(`.${f.key}`) || exprCode === f.key
          );
          if (candidateField && !hasJsxAttribute(node, 'data-preview-field-path')) {
            const fieldSuffix = `.${candidateField.key}`;
            if (listPath) {
              node.openingElement.attributes.push(
                jsxTemplatePathAttr('data-preview-field-path', listPath, 'index', fieldSuffix)
              );
            } else {
              node.openingElement.attributes.push(
                b.jsxAttribute(
                  b.jsxIdentifier('data-preview-field-path'),
                  b.jsxExpressionContainer(
                    b.templateLiteral(
                      [
                        b.templateElement({ raw: '', cooked: '' }, false),
                        b.templateElement({ raw: fieldSuffix, cooked: fieldSuffix }, true),
                      ],
                      [b.identifier('previewItemPath')]
                    )
                  )
                )
              );
            }
            instrumented = true;
            break;
          }
        }
      }
      this.traverse(pathNode);
    },
  });

  return instrumented;
}

module.exports = {
  instrumentChildCardComponent,
};
