'use strict';

const recast = require('recast');
const { parseSource, printSource, t, b, visit } = require('./ast.cjs');
const { analyzeFile } = require('./semantic.cjs');
const { planTransformations } = require('./planner.cjs');
const { applyFilePlan } = require('./transformer.cjs');

const MUTATION_TYPES = [
  'PROP_RENAME',
  'WRAP_FRAGMENT',
  'WRAP_DIV',
  'SPREAD_PROPS',
  'CONDITIONAL_TERNARY',
  'CONDITIONAL_LOGICAL',
  'INJECT_OPTIONAL_CHAIN',
  'NEST_MEMBER_COLLECTION',
  'CORRUPT_SYNTAX',
];

const DEFAULT_SAMPLE_COMPONENT = `
export function HeroSection({ title, subtitle, items = [] }) {
  return (
    <section className="hero-container flex flex-col p-8 bg-white">
      <h1 className="text-4xl font-bold">{title || "Discover Our Coffee"}</h1>
      <p className="text-lg text-gray-600">{subtitle || "Roasted to perfection every morning"}</p>
      <button className="btn btn-primary" onClick={() => console.log('click')}>
        Order Now
      </button>
      <div className="product-list grid grid-cols-3 gap-4">
        {items.map((item, index) => (
          <div key={item.id || index} className="card p-4">
            <h3 className="font-semibold">{item.name}</h3>
            <span className="price">{item.price}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
`;

function mutatePropRename(ast, options = {}) {
  let applied = false;
  let desc = 'No editable prop found to rename';
  visit(ast, {
    visitJSXAttribute(pathNode) {
      if (applied) return false;
      const node = pathNode.node;
      const name = node.name && node.name.name;
      const target = options.propName || (['title', 'label', 'heading', 'subtitle', 'description', 'price', 'name'].includes(name) ? name : null);
      if (target && name === target) {
        const newName = options.newPropName || `fuzzed_${name}`;
        node.name.name = newName;
        applied = true;
        desc = `Renamed prop '${name}' to '${newName}'`;
        return false;
      }
      this.traverse(pathNode);
    },
  });

  if (!applied) {
    // If no attribute matched, find identifier in props parameter
    visit(ast, {
      visitFunction(pathNode) {
        if (applied) return false;
        const params = pathNode.node.params;
        if (params && params[0] && params[0].type === 'ObjectPattern') {
          for (const prop of params[0].properties) {
            if (prop.key && prop.key.name === 'title') {
              prop.key.name = 'fuzzed_title';
              if (prop.value && prop.value.name === 'title') prop.value.name = 'fuzzed_title';
              applied = true;
              desc = "Renamed destructured prop 'title' to 'fuzzed_title'";
              return false;
            }
          }
        }
        this.traverse(pathNode);
      },
    });
  }

  return { applied, desc };
}

function mutateWrapFragment(ast) {
  let applied = false;
  let desc = 'No JSX return statement found to wrap in Fragment';
  visit(ast, {
    visitReturnStatement(pathNode) {
      if (applied) return false;
      const arg = pathNode.node.argument;
      if (arg && (arg.type === 'JSXElement' || arg.type === 'JSXFragment')) {
        pathNode.node.argument = b.jsxFragment(
          b.jsxOpeningFragment(),
          b.jsxClosingFragment(),
          [arg]
        );
        applied = true;
        desc = 'Wrapped root JSX return argument inside <React.Fragment>';
        return false;
      }
      this.traverse(pathNode);
    },
  });
  return { applied, desc };
}

function mutateWrapDiv(ast) {
  let applied = false;
  let desc = 'No JSX return statement found to wrap in <div>';
  visit(ast, {
    visitReturnStatement(pathNode) {
      if (applied) return false;
      const arg = pathNode.node.argument;
      if (arg && (arg.type === 'JSXElement' || arg.type === 'JSXFragment')) {
        const opening = b.jsxOpeningElement(b.jsxIdentifier('div'), [
          b.jsxAttribute(b.jsxIdentifier('className'), b.stringLiteral('fuzzed-container-wrapper')),
        ]);
        const closing = b.jsxClosingElement(b.jsxIdentifier('div'));
        pathNode.node.argument = b.jsxElement(opening, closing, [arg]);
        applied = true;
        desc = 'Wrapped root JSX element in <div className="fuzzed-container-wrapper">';
        return false;
      }
      this.traverse(pathNode);
    },
  });
  return { applied, desc };
}

function mutateSpreadProps(ast, options = {}) {
  let applied = false;
  let desc = 'No JSX element found to inject spread attribute';
  const spreadIdent = options.spreadName || 'fuzzedProps';
  visit(ast, {
    visitJSXOpeningElement(pathNode) {
      if (applied) return false;
      const node = pathNode.node;
      node.attributes.push(b.jsxSpreadAttribute(b.jsxIdentifier(spreadIdent)));
      applied = true;
      desc = `Injected spread attribute {...${spreadIdent}} on <${node.name.name || 'element'}>`;
      return false;
    },
  });
  return { applied, desc };
}

function mutateConditionalTernary(ast) {
  let applied = false;
  let desc = 'No JSX child element found to wrap in ternary expression';
  visit(ast, {
    visitJSXElement(pathNode) {
      if (applied) return false;
      const node = pathNode.node;
      if (node.children && node.children.length > 0) {
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (child.type === 'JSXElement') {
            const fallback = b.jsxElement(
              b.jsxOpeningElement(b.jsxIdentifier('div'), [
                b.jsxAttribute(b.jsxIdentifier('className'), b.stringLiteral('fuzzed-fallback')),
              ]),
              b.jsxClosingElement(b.jsxIdentifier('div')),
              [b.jsxText('Fallback State')]
            );
            const ternary = b.jsxExpressionContainer(
              b.conditionalExpression(
                b.identifier('isFuzzedConditionActive'),
                child,
                fallback
              )
            );
            node.children[i] = ternary;
            applied = true;
            desc = `Wrapped <${child.openingElement?.name?.name || 'element'}> in ternary conditional branch`;
            return false;
          }
        }
      }
      this.traverse(pathNode);
    },
  });
  return { applied, desc };
}

function mutateConditionalLogical(ast) {
  let applied = false;
  let desc = 'No JSX child element found to wrap in logical AND expression';
  visit(ast, {
    visitJSXElement(pathNode) {
      if (applied) return false;
      const node = pathNode.node;
      if (node.children && node.children.length > 0) {
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (child.type === 'JSXElement') {
            const logical = b.jsxExpressionContainer(
              b.logicalExpression(
                '&&',
                b.identifier('showFuzzedContent'),
                child
              )
            );
            node.children[i] = logical;
            applied = true;
            desc = `Wrapped <${child.openingElement?.name?.name || 'element'}> in logical AND (&&) expression`;
            return false;
          }
        }
      }
      this.traverse(pathNode);
    },
  });
  return { applied, desc };
}

function mutateOptionalChain(ast) {
  let applied = false;
  let desc = 'Injected optional chaining expression';
  visit(ast, {
    visitJSXElement(pathNode) {
      if (applied) return false;
      const node = pathNode.node;
      const optionalExpr = b.jsxExpressionContainer(
        b.optionalMemberExpression(
          b.optionalMemberExpression(
            b.identifier('fuzzedConfig'),
            b.identifier('metadata'),
            false,
            true
          ),
          b.identifier('tagline'),
          false,
          true
        )
      );
      node.children.push(optionalExpr);
      applied = true;
      desc = 'Injected optional chaining expression {fuzzedConfig?.metadata?.tagline}';
      return false;
    },
  });
  return { applied, desc };
}

function mutateNestCollection(ast) {
  let applied = false;
  let desc = 'No collection map found to nest';
  visit(ast, {
    visitCallExpression(pathNode) {
      if (applied) return false;
      const node = pathNode.node;
      if (
        node.callee &&
        node.callee.type === 'MemberExpression' &&
        node.callee.property &&
        node.callee.property.name === 'map'
      ) {
        const callback = node.arguments[0];
        if (callback && (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression')) {
          const body = callback.body;
          if (body && body.type === 'JSXElement') {
            const nestedMap = b.jsxExpressionContainer(
              b.callExpression(
                b.memberExpression(
                  b.memberExpression(b.identifier('item'), b.identifier('tags')),
                  b.identifier('map')
                ),
                [
                  b.arrowFunctionExpression(
                    [b.identifier('tag'), b.identifier('tagIdx')],
                    b.jsxElement(
                      b.jsxOpeningElement(b.jsxIdentifier('span'), [
                        b.jsxAttribute(b.jsxIdentifier('key'), b.jsxExpressionContainer(b.identifier('tagIdx'))),
                        b.jsxAttribute(b.jsxIdentifier('className'), b.stringLiteral('badge')),
                      ]),
                      b.jsxClosingElement(b.jsxIdentifier('span')),
                      [b.jsxExpressionContainer(b.identifier('tag'))]
                    )
                  ),
                ]
              )
            );
            body.children.push(nestedMap);
            applied = true;
            desc = 'Injected nested collection mapping item.tags.map(tag => ...)';
            return false;
          }
        }
      }
      this.traverse(pathNode);
    },
  });
  return { applied, desc };
}

function mutateCorruptSyntax(code) {
  const mutated = code.replace(/<([A-Za-z0-9_]+)/, '<$1 <<<< MALFORMED_SYNTAX >>>>');
  return {
    applied: true,
    desc: 'Injected malformed JSX syntax to verify clean parser rejection without crash',
    mutatedCode: mutated !== code ? mutated : code + '\n<<<< UNCLOSED_TOKEN',
  };
}

/**
 * Applies a single mutation to React component source code.
 */
function applyMutation(code, mutationType, options = {}) {
  if (mutationType === 'CORRUPT_SYNTAX') {
    const corrupt = mutateCorruptSyntax(code);
    return {
      mutationType,
      description: corrupt.desc,
      applied: corrupt.applied,
      originalCode: code,
      mutatedCode: corrupt.mutatedCode,
    };
  }

  let ast;
  try {
    ast = parseSource(code, options.filePath || 'component.tsx');
  } catch (err) {
    return {
      mutationType,
      description: `Failed to parse original code: ${err.message}`,
      applied: false,
      originalCode: code,
      mutatedCode: code,
    };
  }

  let mutationOutcome;
  switch (mutationType) {
    case 'PROP_RENAME':
      mutationOutcome = mutatePropRename(ast, options);
      break;
    case 'WRAP_FRAGMENT':
      mutationOutcome = mutateWrapFragment(ast);
      break;
    case 'WRAP_DIV':
      mutationOutcome = mutateWrapDiv(ast);
      break;
    case 'SPREAD_PROPS':
      mutationOutcome = mutateSpreadProps(ast, options);
      break;
    case 'CONDITIONAL_TERNARY':
      mutationOutcome = mutateConditionalTernary(ast);
      break;
    case 'CONDITIONAL_LOGICAL':
      mutationOutcome = mutateConditionalLogical(ast);
      break;
    case 'INJECT_OPTIONAL_CHAIN':
      mutationOutcome = mutateOptionalChain(ast);
      break;
    case 'NEST_MEMBER_COLLECTION':
      mutationOutcome = mutateNestCollection(ast);
      break;
    default:
      return {
        mutationType,
        description: `Unknown mutation type: ${mutationType}`,
        applied: false,
        originalCode: code,
        mutatedCode: code,
      };
  }

  const mutatedCode = mutationOutcome.applied ? printSource(ast, code) : code;
  return {
    mutationType,
    description: mutationOutcome.desc,
    applied: mutationOutcome.applied,
    originalCode: code,
    mutatedCode,
  };
}

/**
 * Generates a diverse suite of fuzzed variations across mutation types.
 */
function generateFuzzCorpus(code, options = {}) {
  const types = options.mutationTypes || MUTATION_TYPES;
  const corpus = [];

  for (const type of types) {
    const result = applyMutation(code, type, options);
    if (result.applied) {
      corpus.push(result);
    }
  }

  return corpus;
}

/**
 * Tests ARC's resilience against a mutated component code string.
 * Verifies syntax validity, absence of unhandled crashes, and clean recovery/rejection.
 */
function testMutationResilience(mutatedCode, mutationType, options = {}) {
  const filePath = options.filePath || 'src/components/Hero.tsx';
  const profile = {
    root: process.cwd(),
    framework: 'Next.js',
    routerType: 'app-router',
  };

  // 1. AST Parse Gate
  let ast;
  try {
    ast = parseSource(mutatedCode, filePath);
  } catch (err) {
    if (mutationType === 'CORRUPT_SYNTAX') {
      return {
        mutationType,
        description: 'Corrupt syntax cleanly caught by AST parser at boundary',
        parsed: false,
        analyzed: false,
        transformed: false,
        outputValidSyntax: false,
        crashed: false,
        candidatesFound: 0,
        transformationsApplied: 0,
        status: 'PARSER_REJECTED_CLEANLY',
        resilient: true,
      };
    }
    return {
      mutationType,
      description: `Unexpected parse error on mutated code: ${err.message}`,
      parsed: false,
      analyzed: false,
      transformed: false,
      outputValidSyntax: false,
      crashed: false,
      errorMessage: err.message,
      candidatesFound: 0,
      transformationsApplied: 0,
      status: 'CRASHED',
      resilient: false,
    };
  }

  // 2. Semantic Analysis Gate
  let analysis;
  try {
    analysis = analyzeFile({
      code: mutatedCode,
      relativeFile: filePath,
      profile,
    });
    analysis.relativeFile = filePath;
    analysis.code = mutatedCode;
  } catch (err) {
    return {
      mutationType,
      description: `Semantic analyzer crashed on AST: ${err.message}`,
      parsed: true,
      analyzed: false,
      transformed: false,
      outputValidSyntax: false,
      crashed: true,
      errorMessage: err.message,
      candidatesFound: 0,
      transformationsApplied: 0,
      status: 'CRASHED',
      resilient: false,
    };
  }

  const candidatesFound = analysis.candidates ? analysis.candidates.length : 0;

  // 3. Transformation Planning Gate
  let planResult;
  try {
    planResult = planTransformations({
      profile,
      analyses: [analysis],
      recipe: null,
    });
  } catch (err) {
    return {
      mutationType,
      description: `Planner crashed on candidates: ${err.message}`,
      parsed: true,
      analyzed: true,
      transformed: false,
      outputValidSyntax: false,
      crashed: true,
      errorMessage: err.message,
      candidatesFound,
      transformationsApplied: 0,
      status: 'CRASHED',
      resilient: false,
    };
  }

  const filePlan = (planResult.files && planResult.files[0]) || (planResult.filePlans && planResult.filePlans[0]) || {
    originalCode: mutatedCode,
    file: filePath,
    transformations: [],
  };
  if (!filePlan.originalCode) filePlan.originalCode = mutatedCode;
  if (!filePlan.file) filePlan.file = filePath;

  // 4. Transform Execution Gate
  let transformResult;
  try {
    transformResult = applyFilePlan(filePlan, profile);
  } catch (err) {
    return {
      mutationType,
      description: `Transformer crashed during AST rewrites: ${err.message}`,
      parsed: true,
      analyzed: true,
      transformed: false,
      outputValidSyntax: false,
      crashed: true,
      errorMessage: err.message,
      candidatesFound,
      transformationsApplied: 0,
      status: 'CRASHED',
      resilient: false,
    };
  }

  const transformedCode = transformResult.code || mutatedCode;
  const transformationsApplied = transformResult.applied || 0;

  // 5. Output AST Validation Gate
  let outputValidSyntax = true;
  try {
    parseSource(transformedCode, filePath);
  } catch {
    outputValidSyntax = false;
  }

  const status = !outputValidSyntax
    ? 'CRASHED'
    : transformationsApplied > 0
      ? 'ADAPTED_CLEANLY'
      : 'SKIPPED_SAFELY';

  const resilient = outputValidSyntax && status !== 'CRASHED';

  return {
    mutationType,
    description: `Fuzz test completed: ${status} (${transformationsApplied} transforms applied)`,
    parsed: true,
    analyzed: true,
    transformed: transformResult.changed || false,
    outputValidSyntax,
    crashed: false,
    candidatesFound,
    transformationsApplied,
    status,
    resilient,
  };
}

/**
 * Executes the complete fuzz harness across all mutation types and computes resilience metrics.
 */
function runFuzzHarness(componentCode = DEFAULT_SAMPLE_COMPONENT, options = {}) {
  const corpus = generateFuzzCorpus(componentCode, options);
  const results = [];

  for (const mutation of corpus) {
    const outcome = testMutationResilience(mutation.mutatedCode, mutation.mutationType, options);
    results.push(outcome);
  }

  const totalMutations = results.length;
  const resilientCount = results.filter((r) => r.resilient).length;
  const crashedCount = results.filter((r) => r.crashed).length;
  const syntaxErrorsInOutput = results.filter((r) => !r.outputValidSyntax && r.parsed).length;
  const resilienceScore = totalMutations > 0
    ? Number(((resilientCount / totalMutations) * 100).toFixed(1))
    : 100.0;

  return {
    timestamp: new Date().toISOString(),
    totalMutations,
    resilientCount,
    crashedCount,
    syntaxErrorsInOutput,
    resilienceScore,
    allResilient: resilientCount === totalMutations && crashedCount === 0,
    results,
  };
}

module.exports = {
  MUTATION_TYPES,
  DEFAULT_SAMPLE_COMPONENT,
  applyMutation,
  generateFuzzCorpus,
  testMutationResilience,
  runFuzzHarness,
};
