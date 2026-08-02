Original prompt: shadowmatic 같은 게임을 웹으로 처음부터 제작. 목표 실루엣에서 3D 형상을 만들고, 추후 Blender/Blender MCP를 연결해 맵과 에셋 제작까지 확장.

## 진행 기록

- 기존 `ShadowMerge` 저장소는 사용자 요청에 따라 복구하거나 재사용하지 않고 격리함.
- 새 `ShadowmaticWeb` 프로젝트를 독립적으로 시작함.
- Vite + React + TypeScript + React Three Fiber 기반 골격 추가.
- 코드로 생성한 고래 실루엣의 압출·깊이 변형 3D 형상 추가.
- 빛 카메라 RenderTarget을 벽 표시와 IoU 판정에 함께 사용하는 구조 추가.
- 마우스/터치 회전, 정렬 보조, 재시작, 전체화면, 완료 상태 추가.
- `render_game_to_text`, `advanceTime` 자동 검증 훅 추가.
- 레벨 설정을 `src/content/levels/whale-001.json`으로 분리함.
- Blender의 첫 천문대 테마를 headless 방식으로 생성·GLB export하는 Python 파이프라인 추가.
- Codex Blender MCP 설정에서 `cwd`와 `enabled`가 잘못 env 하위에 있던 문제를 수정하고 서버를 활성화함. 현재 세션 재시작 전에는 Blender 도구가 노출되지 않을 수 있음.
- React 검토에서 60fps 렌더 루프가 매 프레임 App 전체를 재렌더링하던 경로를 발견해, 점수·상태·50ms hold 구간이 바뀔 때만 UI snapshot을 발행하도록 수정함.

## 다음 검증

- 의존성 설치 완료. `npm test` 7/7 통과, `npm run build` 성공, Blender Python 문법 검사 성공.
- Playwright 클라이언트로 시작·드래그·Assist·완료·재시작 검증.
- 실제 스크린샷 확인 후 카메라·조명·UI 조정.
- Blender MCP 도구가 새 세션에 노출되면 천문대 GLB를 실제 생성하고 웹 solved-mask round-trip 검증 추가.
- 사용자 승인 후에만 Playwright UI 자동 조작과 스크린샷 검증 수행.
