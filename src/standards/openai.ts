// ABOUTME: OpenAI Apps SDK standard specification.
// ABOUTME: Defines field paths for text/html+skybridge and openai/* metadata.

import type { StandardSpec } from './spec.js';

export const OPENAI_STANDARD: StandardSpec = {
  name: 'openai',
  displayName: 'OpenAI Apps SDK',
  specRef: 'https://developers.openai.com/apps-sdk/build/mcp-server',

  widgetUriScheme: 'ui://widget/',
  widgetUriPattern: /^ui:\/\/widget\//,
  widgetMimeType: 'text/html+skybridge',

  toolMeta: {
    outputTemplate: '_meta.openai/outputTemplate',
    visibility: '_meta.openai/visibility',
    csp: '_meta.openai/widgetCSP',
    widgetAccessible: '_meta.openai/widgetAccessible',
    toolInvocation: '_meta.openai/toolInvocation',
    fileParams: '_meta.openai/fileParams',
  },

  resourceMeta: {
    widgetDescription: '_meta.openai/widgetDescription',
    widgetPrefersBorder: '_meta.openai/widgetPrefersBorder',
    csp: '_meta.openai/widgetCSP',
  },

  cspFields: {
    connectDomains: 'connect_domains',
    frameDomains: 'frame_domains',
  },

  hasPermissions: false,
  permissionsPath: '',
};
