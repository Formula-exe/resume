/* 项目内容沿用 resume；这里只保存稳定 ID、真实资料链接的映射与固定星座节点。 */
window.RESUME_PROJECT_CONSTELLATIONS = {
  nodeSize: 7,
  nodeColor: '#f2ddc0',
  lineColor: '#b08662',
  lineOpacity: .62,
  diagrams: {
    'llm-agents': {
      nodes: [[-.86,.12],[-.48,.43],[-.07,.17],[.34,.42],[.78,.05],[.31,-.36]],
      edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,2]]
    },
    'aigc-design': {
      nodes: [[-.79,-.24],[-.47,.31],[.03,.46],[.73,.19],[.38,-.38]],
      edges: [[0,1],[1,2],[2,3],[3,4],[4,0],[1,4]]
    },
    'science-writing': {
      nodes: [[-.83,.32],[-.45,-.16],[-.04,.19],[.28,-.35],[.64,.03],[.85,.38]],
      edges: [[0,1],[1,2],[2,3],[3,4],[4,5]]
    }
  },
  references: {
    'llm-agents': { certificates: [0,1] },
    'aigc-design': { certificates: [2] },
    'science-writing': { href: '#education', label: { zh: '查看教育与奖项记录', en: 'View education and award record' } }
  }
};
