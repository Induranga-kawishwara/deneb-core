'use strict';

const recast = require('recast');
const {
  hasJsxAttribute,
  b,
} = require('../../ast.cjs');

function instrumentReusableComponent(ast, transform, isTypeScript = false) {
  const componentName = transform.componentName;
  const propTransforms = transform.propTransforms || {};
  const propNames = Object.keys(propTransforms);
  if (!propNames.length) return false;

  let instrumented = false;

  function updateTsInterface(rootAst, interfaceName) {
    recast.types.visit(rootAst, {
      visitTSInterfaceDeclaration(pathNode) {
        if (pathNode.node.id?.name === interfaceName) {
          const body = pathNode.node.body?.body || [];
          if (!body.some((m) => m.key?.name === 'previewPath')) {
            const sig = b.tsPropertySignature(b.identifier('previewPath'), b.tsTypeAnnotation(b.tsStringKeyword()));
            sig.optional = true;
            body.push(sig);
            instrumented = true;
          }
        }
        this.traverse(pathNode);
      },
      visitTSTypeAliasDeclaration(pathNode) {
        if (pathNode.node.id?.name === interfaceName && pathNode.node.typeAnnotation?.type === 'TSTypeLiteral') {
          const members = pathNode.node.typeAnnotation.members || [];
          if (!members.some((m) => m.key?.name === 'previewPath')) {
            const sig = b.tsPropertySignature(b.identifier('previewPath'), b.tsTypeAnnotation(b.tsStringKeyword()));
            sig.optional = true;
            members.push(sig);
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
          b.property('init', b.identifier('previewPath'), b.identifier('previewPath')),
        ]),
      ];
      changed = true;
    } else {
      const firstParam = params[0];
      if (firstParam.type === 'ObjectPattern') {
        const hasPreviewPath = firstParam.properties.some(
          (p) => p.key?.name === 'previewPath' || p.argument?.name === 'previewPath'
        );
        if (!hasPreviewPath) {
          const prop = b.property('init', b.identifier('previewPath'), b.identifier('previewPath'));
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
              if (!propsList.some((p) => p.key?.name === 'previewPath')) {
                const prop = b.property('init', b.identifier('previewPath'), b.identifier('previewPath'));
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
      if (!componentName || pathNode.node.id?.name === componentName) {
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

  recast.types.visit(ast, {
    visitJSXElement(pathNode) {
      const node = pathNode.node;
      for (const child of node.children || []) {
        if (child.type === 'JSXExpressionContainer') {
          const expr = child.expression;
          let propMatch = null;
          if (expr && expr.type === 'Identifier' && propNames.includes(expr.name)) {
            propMatch = expr.name;
          } else if (expr && expr.type === 'LogicalExpression' && expr.left?.name && propNames.includes(expr.left.name)) {
            propMatch = expr.left.name;
          }
          if (propMatch && !hasJsxAttribute(node, 'data-preview-field-path')) {
            const previewAttr = b.jsxAttribute(
              b.jsxIdentifier('data-preview-field-path'),
              b.jsxExpressionContainer(
                b.conditionalExpression(
                  b.identifier('previewPath'),
                  b.templateLiteral(
                    [
                      b.templateElement({ raw: '', cooked: '' }, false),
                      b.templateElement({ raw: `.${propMatch}`, cooked: `.${propMatch}` }, true),
                    ],
                    [b.identifier('previewPath')]
                  ),
                  b.identifier('undefined')
                )
              )
            );
            node.openingElement.attributes.push(previewAttr);
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
  instrumentReusableComponent,
};
