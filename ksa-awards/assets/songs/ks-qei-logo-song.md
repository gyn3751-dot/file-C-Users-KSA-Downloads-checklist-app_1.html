# KS-QEI 로고송 (예시) — 「믿음의 이름, KS-QEI」

- 길이 32초 · 120 BPM · C장조 · 밝은 신스 리드 + 패드 + 베이스 + 드럼 (반주 + 가이드 멜로디, 보컬 없음)
- 파일: `ks-qei-logo-song.mp3` (보관용), `ks-qei-logo-song.webm` (사이트 업로드용)
- 다시 만들기: `python3 make-ks-qei-song.py out.wav` (numpy 필요)

| 마디 | 코드 | 가사 |
|---|---|---|
| 1–2 | C · G | 반짝이는 하루를 채우는 |
| 3–4 | Am · F | 고객의 진짜 목소리 |
| 5–6 | C · G | 써 보고 느껴 본 그대로 |
| 7–8 | F · G | 품질로 답할게요 |
| 9–10 | F · G | 믿음의 이름, KS-QEI |
| 11–12 | Em · Am | 고객이 고른 품질 1위 |
| 13–14 | Dm · G | 한국품질만족지수 |
| 15 | C | 딩-동! |

## 보컬 버전 (`ks-qei-logo-song-vocal.mp3` / `.webm`)

- 합성 보컬: espeak-ng 한국어 음성으로 음절을 만든 뒤 WORLD(pyworld)로 음 높이·길이·음색을 노래에 맞게 바꿈 (반주의 가이드 멜로디는 작게)
- 연음이 자연스럽도록 소리 나는 대로 부름: 반짜기는 · 고개게 · 목쏘리 · 다팔게요 · 미드메 이름 · 케이에스 큐이아이 · 고개기 고른 · 품질 이뤼
- 다시 만들기: `pip install espeakng-loader pyworld numpy` 후 `VOCAL=1 LEADG=.10 python3 make-ks-qei-song-vocal.py out.wav` (esp.py, vocal.py 같은 폴더)
