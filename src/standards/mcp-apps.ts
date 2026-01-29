// ABOUTME: MCP Apps (SEP-1865) standard specification.
// ABOUTME: Defines field paths for text/html;profile=mcp-app and _meta.ui.* metadata.

import type { StandardSpec } from './spec.js';

export const MCP_APPS_STANDARD: StandardSpec = {
  name: 'mcp-apps',
  displayName: 'MCP Apps (SEP-1865)',
  specRef: 'https://github.com/anthropics/mcp-specification/blob/main/docs/specification/extensions/apps/sep-1865.md',

  widgetUriScheme: 'ui://',
  widgetUriPattern: /^ui:\/\//,
  widgetMimeType: 'text/html;profile=mcp-app',

  toolMeta: {
    outputTemplate: '_meta.ui.resourceUri',
    visibility: '_meta.ui.visibility',
    csp: '_meta.ui.csp',
    widgetAccessible: '', // Not in MCP Apps standard
    toolInvocation: '', // Not in MCP Apps standard
    fileParams: '', // Not in MCP Apps standard
  },

  resourceMeta: {
    widgetDescription: '_meta.ui.description',
    widgetPrefersBorder: '', // Not in MCP Apps standard
    csp: '_meta.ui.csp',
  },

  cspFields: {
    connectDomains: 'connectDomains',
    frameDomains: 'frameDomains',
  },

  hasPermissions: true,
  permissionsPath: '_meta.ui.permissions',
};
