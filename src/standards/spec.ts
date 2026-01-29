// ABOUTME: Interface defining standard-specific field mappings and patterns.
// ABOUTME: Allows validators to work with different standards via configuration.

/**
 * StandardSpec encapsulates all differences between OpenAI Apps SDK and MCP Apps standards.
 * Validators use this to resolve field paths without hardcoding standard-specific values.
 */
export interface StandardSpec {
  /** Internal identifier for the standard */
  name: 'openai' | 'mcp-apps';

  /** Human-readable display name */
  displayName: string;

  /** URL to specification documentation */
  specRef: string;

  /** Expected prefix for widget URIs (e.g., "ui://widget/" or "ui://") */
  widgetUriScheme: string;

  /** Regex pattern for validating widget URIs */
  widgetUriPattern: RegExp;

  /** MIME type expected for widget resources */
  widgetMimeType: string;

  /** Paths to tool _meta fields (empty string means field not in this standard) */
  toolMeta: {
    /** Path to output template field (e.g., "_meta.openai/outputTemplate" or "_meta.ui.resourceUri") */
    outputTemplate: string;
    /** Path to visibility field */
    visibility: string;
    /** Path to CSP configuration */
    csp: string;
    /** Path to widget accessible field */
    widgetAccessible: string;
    /** Path to tool invocation messages */
    toolInvocation: string;
    /** Path to file params */
    fileParams: string;
  };

  /** Paths to resource _meta fields */
  resourceMeta: {
    /** Path to widget description */
    widgetDescription: string;
    /** Path to widget border preference */
    widgetPrefersBorder: string;
    /** Path to CSP configuration */
    csp: string;
  };

  /** Field names within CSP configuration object */
  cspFields: {
    /** Connect domains field (e.g., "connect_domains" or "connectDomains") */
    connectDomains: string;
    /** Frame domains field */
    frameDomains: string;
  };

  /** Whether this standard supports permissions declarations */
  hasPermissions: boolean;

  /** Path to permissions if supported (empty if not) */
  permissionsPath: string;
}
