declare var ungit: {
  config: typeof import('../../source/config');
  server: import('../../public/source/server');
  __app: any;
  userHash: string;
  version: string;
  platform: string;
  pluginApiVersion: string;
  logger: {
    debug: typeof console.log;
    info: typeof console.log;
    warn: typeof console.log;
    error: typeof console.log;
  };
  components: any;
  programEvents: any;
};

interface Window {
  mina: any;
}

type GraphEdge = import('./edge');
type GitGraph = import('./graph');
type GraphNode = import('./git-node');
type GraphRef = import('./git-ref');
