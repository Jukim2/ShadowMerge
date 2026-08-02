# UMBRA — 3D Shadow Puzzle

Shadowmatic의 핵심 원리를 웹에서 검증하기 위한 독립적인 수직 프로토타입입니다. 추상 3D 조형물을 회전해 벽의 숨은 실루엣을 찾습니다.

## 실행

```bash
npm install
npm run dev
```

## 조작

- 마우스/터치 드래그: 조형물 회전
- `H` 또는 Space: 정렬 보조
- `R`: 다시 시작
- `F`: 전체화면

## 구조

- 빛 방향의 직교 카메라가 퍼즐 메시를 128×128 마스크로 렌더링합니다.
- 같은 마스크 텍스처를 벽에 표시하고 목표 마스크와 IoU로 비교합니다.
- 정답은 별도 이미지가 아니라 해결 자세에서 동일한 메시를 렌더링해 생성합니다.
- `window.render_game_to_text()`와 `window.advanceTime(ms)`를 자동 검증용으로 제공합니다.
