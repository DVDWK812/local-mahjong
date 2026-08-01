import { TEST_CASE_DEFINITION_VERSION, type UiInteractionTestCase } from './types';

const ACCEPTED_VIEWPORTS = [
  [1280, 720],
  [1366, 768],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
] as const;

const REJECTED_VIEWPORTS = [
  [1279, 720],
  [1280, 719],
] as const;

export const STAB012_TEST_CASE_IDS = [
  ...ACCEPTED_VIEWPORTS.map(([width, height]) => `STAB-012-${width}X${height}`),
  ...REJECTED_VIEWPORTS.map(([width, height]) => `STAB-012-${width}X${height}-TOO-SMALL`),
];

export function getStab012TestCases(): UiInteractionTestCase[] {
  return [
    ...ACCEPTED_VIEWPORTS.map(([width, height]) => viewportCase(width, height, true)),
    ...REJECTED_VIEWPORTS.map(([width, height]) => viewportCase(width, height, false)),
  ];
}

function viewportCase(width: number, height: number, supported: boolean): UiInteractionTestCase {
  const size = `${width}×${height}`;
  return {
    version: TEST_CASE_DEFINITION_VERSION,
    id: `STAB-012-${width}X${height}${supported ? '' : '-TOO-SMALL'}`,
    name: `STAB-012 桌面视口 ${size}`,
    description: supported
      ? `在 ${size} 横屏桌面视口核对固定逻辑牌桌的完整性。`
      : `在 ${size} 视口确认不压缩牌桌并显示窗口过小提示。`,
    relatedAuditId: 'STAB-012',
    category: 'ui-keyboard',
    kind: 'ui-interaction',
    route: '/?testMode=1',
    steps: supported
      ? [{ action: 'resize', value: `${width}x${height}` }, { action: 'assert-visible', target: '麻将牌桌' }]
      : [{ action: 'resize', value: `${width}x${height}` }, { action: 'assert-visible', target: '当前窗口尺寸过小' }],
    expectedResults: supported
      ? ['左右玩家状态、宝牌、副露、牌河、中央计分板和本家手牌完整且互不遮挡', '顶部按钮可操作，页面无水平滚动且关键内容无需整页垂直滚动']
      : ['显示当前窗口尺寸过小和最低横屏1280×720说明', '提供返回菜单且不渲染被强行压缩的牌桌'],
    manualSteps: supported
      ? [`将浏览器视口设为 ${size}`, '进入任一可操作场景并核对牌桌与顶部工具栏', '切换到普通游戏和牌谱确认几何一致']
      : [`将浏览器视口设为 ${size}`, '确认出现尺寸过小提示', '点击返回菜单确认页面可关闭'],
    tags: ['界面', '桌面', '分辨率', supported ? '支持范围' : '尺寸过小', '人工'],
  };
}
