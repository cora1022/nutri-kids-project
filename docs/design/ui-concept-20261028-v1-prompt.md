# 든든 UI 콘셉트 v1

생성 방식: 내장 imagegen. 로그인과 게스트 선택, 분석 결과, 설정 화면의 미리보기용 시안입니다.
참조: 기존 logo.png와 meal-analysis-cropped.png. 수치는 UI 검토를 위한 예시입니다.

## 생성 프롬프트

+Use case: ui-mockup.
Asset type: a polished high-fidelity mobile web app UI concept board for the real Korean nutrition project "든든". This is a NEW UI DESIGN, using the supplied images only as brand and content references.
Input images: Image 1 (logo.png) is the existing brand logo reference: preserve the friendly green bowl mark and the name 든든. Image 2 (meal-analysis-cropped.png) is a reference for the current purple brand and existing nutrition data only, not a layout to reproduce.
Primary request: a landscape presentation board showing THREE large, crisp, front-facing mobile UI artboards side by side. Left = initial login versus guest selection. Center = thoroughly redesigned meal analysis result, the most important panel. Right = settings page reached by the gear icon in the upper right. The same thin-line gear icon sits in the upper-right header of ALL THREE screens. Show modern realistic buildable React UI, no angled phones, no hands, no photographic device mockups. Display the full screens including bottom actions. High-resolution landscape board, roughly 2048 by 1408. Pure white presentation canvas, very restrained faint lavender shadows, consistent light surfaces.
Visual system: existing friendly purple #7C3AED, ink #2B2140, white, near-white lavender #FBF8FF, tiny touches of the logo's leafy green. Pretendard-like Korean sans-serif, excellent Hangul rendering, clear typographic hierarchy, carefully aligned grid, compact grouped data rows, 18-24px card corners, understated dividers, comfortable touch targets. Stylish, welcoming and respectful to teenagers. Existing bowl logo only, no invented character or mascot. Clear readable Korean text, no lorem ipsum, no watermark. Do not use the U+00B7 middle dot anywhere.
Board top: small editorial title "든든 화면 개편안". Short labels above the three panels: "시작 화면", "분석 결과", "설정".

LEFT SCREEN:
Top header small existing logo and "든든", gear in upper right. A large centered version of the existing green bowl logo with subtle lavender circular backdrop. Main headline in two lines: "오늘 한 끼," / "든든하게 시작해요". One quiet line "나에게 맞는 영양을 확인해요".
In lower-middle, two very obvious full-width distinct buttons: white outlined official-looking multicolor Google G and "구글 계정으로 로그인"; solid purple rounded button "게스트로 시작하기". Both feel equally easy to find; guest is a genuine option.
Below buttons, two short subdued explanatory lines: "로그인하면 식사 기록이 저장돼요" and "게스트 기록은 이 기기에만 남아요". Spacious, inviting opening screen, never a crowded dashboard.

CENTER SCREEN, visually the richest and clearest:
Header left small logo and "든든", right gear icon. Heading "이번 한 끼 결과", subtitle "10월 28일 점심". Compact segmented switch "이번 한 끼" selected in purple and "오늘 전체" unselected.
Hero summary card tinted light lavender, small label "한 끼 열량", large "520" with small "kcal", secondary "/ 목표 800 kcal", horizontal 65 percent progress bar. Beneath, short clear recommendation summary "칼슘과 비타민 C를 더해보세요". Do not invent an overall health score, clinical diagnosis, or a grade.
Below hero, group heading "영양소 한눈에". ONE compact white grouped card with aligned rows, values, small restrained status badges and thin bars:
"단백질" "16 / 20 g" badge "보완"
"탄수화물" "75 / 115 g" badge "보완"
"칼슘" "180 / 300 mg" badge "보완"
"비타민 C" "12 / 30 mg" badge "보완"
"비타민 D" "미확인" neutral badge and a gray dashed track, NOT a zero bar.
At card bottom quiet disclosure "전체 영양소 보기" with chevron. Tiny source-quality chip "추정값 포함". These are illustrative concept numbers, not live measurements. If sodium or iron are shown at all, they must say "섭취량만 표시", never judged adequate or over the limit.
Below, short recommendation section heading "이렇게 보완해보세요". A neat horizontal product suggestion card with a simple milk carton thumbnail, "흰 우유", secondary "칼슘 보완", small outlined "담기" button. No detailed unverifiable nutrient claims or real retail brand trademarks.
Bottom action area: secondary outline "음식 추가" and primary purple "식사 저장하기". Make the primary action prominent and keep content hierarchy exceptionally scannable. Small bottom note "예시 데이터" to distinguish concept from real analysis.

RIGHT SCREEN:
Clean header with back arrow, title "설정", gear upper right using the same header position.
Account card with simple purple initial/avatar circle, nickname "든든친구", small label "구글 계정으로 로그인 중".
Section "내 프로필": grouped white card with rows "닉네임" value "든든친구"; "키" value "165 cm"; "몸무게" value "55 kg"; "하루 식사" value "3끼"; subtle chevrons for edit. One small top-right "수정" text action.
Section "기록과 정보": clean list rows "저장한 식사 기록" with chevron, "영양 데이터 출처" with chevron, "서비스 정보" with chevron.
At bottom quiet outlined "로그아웃". Do not add notifications, premium plans, streaks, social feeds, or invented features. Keep account and profile actions inside settings, not scattered across the main app header.

Composition constraints: three distinct complete artboards, ample separation between them, consistent heights and shared design system; central result screen must remain highly legible and show both the nutrition group and recommendation with save button. No code, no REST API text, no SQL, no backend terminology in product UI. All labels in Korean exactly as quoted where feasible. Deliver a refined product-design concept image, not implementation code.
