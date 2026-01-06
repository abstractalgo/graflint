import type { OCIFDocument } from "./types/ocif";
import type {
  GraflintConfig,
  CheckResult,
  Diagnostic,
  Rule,
  NodeRule,
  RelationRule,
  ResourceRule,
  CanvasRule,
  RuleConfig,
} from "./types/diagnostic";
import { createContext } from "./context";
import { createOverlay } from "./overlay";

// Registry of all available rules
const ruleRegistry: Map<string, Rule> = new Map();

/**
 * Register a rule in the global registry
 */
export function registerRule(rule: Rule): void {
  ruleRegistry.set(rule.id, rule);
}

/**
 * Get a rule by ID
 */
export function getRule(id: string): Rule | undefined {
  return ruleRegistry.get(id);
}

/**
 * Get all registered rules
 */
export function getAllRules(): Rule[] {
  return [...ruleRegistry.values()];
}

/**
 * Parse rule config to get severity and options
 */
function parseRuleConfig(config: RuleConfig): {
  enabled: boolean;
  severity: "error" | "warning";
  options: Record<string, unknown>;
} {
  if (config === "off") {
    return { enabled: false, severity: "error", options: {} };
  }
  if (config === "error" || config === "warn") {
    return {
      enabled: true,
      severity: config === "warn" ? "warning" : "error",
      options: {},
    };
  }
  // Array form: ['warn' | 'error', options]
  return {
    enabled: true,
    severity: config[0] === "warn" ? "warning" : "error",
    options: config[1],
  };
}

/**
 * Check a canvas for issues
 */
export function check(
  canvas: OCIFDocument,
  config: GraflintConfig
): CheckResult {
  const diagnostics: Diagnostic[] = [];

  // Process each configured rule
  for (const [ruleId, ruleConfig] of Object.entries(config.rules)) {
    const { enabled, severity, options } = parseRuleConfig(ruleConfig);
    if (!enabled) {
      continue;
    }

    const rule = ruleRegistry.get(ruleId);
    if (!rule) {
      console.warn(`Unknown rule: ${ruleId}`);
      continue;
    }

    // Merge global settings with rule options
    const mergedOptions = { ...config.settings, ...options };
    const ctx = createContext(canvas, mergedOptions);

    try {
      const ruleDiagnostics = runRule(rule, canvas, ctx);

      // Override severity based on config
      for (const diag of ruleDiagnostics) {
        diag.severity = severity;
        diagnostics.push(diag);
      }
    } catch (error) {
      console.error(`Error running rule ${ruleId}:`, error);
    }
  }

  // Create OCIF overlay from diagnostics
  const overlay = createOverlay(diagnostics);

  return { diagnostics, overlay };
}

/**
 * Run a single rule against the document
 */
function runRule(
  rule: Rule,
  canvas: OCIFDocument,
  ctx: ReturnType<typeof createContext>
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  switch (rule.target) {
    case "node": {
      const nodeRule = rule as NodeRule;
      for (const node of canvas.nodes ?? []) {
        if (nodeRule.filter && !nodeRule.filter(node, ctx)) {
          continue;
        }
        try {
          const results = nodeRule.check(node, ctx);
          diagnostics.push(...results);
        } catch (error) {
          console.error(`Error in rule ${rule.id} on node ${node.id}:`, error);
        }
      }
      break;
    }

    case "relation": {
      const relationRule = rule as RelationRule;
      for (const relation of canvas.relations ?? []) {
        if (relationRule.filter && !relationRule.filter(relation, ctx)) {
          continue;
        }
        try {
          const results = relationRule.check(relation, ctx);
          diagnostics.push(...results);
        } catch (error) {
          console.error(
            `Error in rule ${rule.id} on relation ${relation.id}:`,
            error
          );
        }
      }
      break;
    }

    case "resource": {
      const resourceRule = rule as ResourceRule;
      for (const resource of canvas.resources ?? []) {
        if (resourceRule.filter && !resourceRule.filter(resource, ctx)) {
          continue;
        }
        try {
          const results = resourceRule.check(resource, ctx);
          diagnostics.push(...results);
        } catch (error) {
          console.error(
            `Error in rule ${rule.id} on resource ${resource.id}:`,
            error
          );
        }
      }
      break;
    }

    case "canvas": {
      const canvasRule = rule as CanvasRule;
      try {
        const results = canvasRule.check(canvas, ctx);
        diagnostics.push(...results);
      } catch (error) {
        console.error(`Error in rule ${rule.id} on canvas:`, error);
      }
      break;
    }
  }

  return diagnostics;
}
