# Blender pipeline

Blender는 퍼즐 판정의 원본이 아니라 방·소품·재질을 제작하는 보조 도구입니다.

## 첫 테마 생성

```bash
blender --background \
  --python tools/blender/create_observatory.py \
  -- public/assets/observatory-room.glb
```

스크립트는 현재 Blender 장면을 지우므로 반드시 새 background 프로세스에서 실행합니다. 결과 GLB에는 중앙 그림자 벽이 포함되지 않습니다. 그림자 벽과 퍼즐 조형물은 웹 렌더러가 관리합니다.

## MCP 연결

Codex 설정의 `mcp_servers.blender`가 활성화되어야 합니다. MCP가 현재 세션에 로드된 뒤에는 Blender에서 장면 생성, 재질 수정, GLB export를 실행할 수 있습니다. export 결과는 이후 웹의 solved-mask 검증을 반드시 통과해야 합니다.
