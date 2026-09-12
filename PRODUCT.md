# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + React + TypeScript. Chosen for a static Netlify deploy and client-side video handling. No server-side video pipeline in this MVP.

## Users

SNS와 유튜브를 자주 보는 청년, 대학생, 일반 사용자. 친구가 보낸 영상이나 공유 직전의 숏폼이 실제 촬영인지 의심될 때 빠르게 확인한다.

## Product Purpose

딥체크(Deep Check)는 영상을 올리면 프레임과 움직임의 이상 징후를 보고, AI 생성 또는 조작 가능성과 근거를 한 화면에 보여 주는 웹 서비스다. 성공은 설명 없이 업로드하고 결과를 이해한 뒤, 공유 여부를 더 신중히 판단하는 것이다.

## Positioning

연구소급 탐지기가 아니라, 일반인이 영상 하나를 넣고 점수와 의심 구간을 바로 읽는 가벼운 확인 창구. 결과는 판정이 아니라 참고용 가능성이다.

## Operating Context

브라우저에서 MP4 등 파일을 올리고 분석을 기다린 뒤 점수, 판정 수준, 의심 구간을 본다. 유튜브/SNS 링크는 이번 범위에서 뺀다. 배포 대상은 Netlify다.

## Capabilities and Constraints

포함: 파일 업로드, 클라이언트 휴리스틱 분석, 백분율 점수, 의심 구간과 짧은 근거, 한계 안내.
제외: PDF 보고서, 링크 첨부, 직접 학습한 탐지 모델.
기술 한계: 최신 생성 영상은 오탐/미탐이 있다. 점수는 가능성이며 진위 확정이 아니다.
스택 결정은 기획안과 배포 요청에서 위임된 것으로 기록한다.

## Brand Commitments

이름: 딥체크 (Deep Check). 한 줄: AI 생성/조작 영상의 가능성을 분석해 신뢰도와 근거를 보여주는 웹 서비스. 카피는 판정 어조가 아니라 가능성과 근거 어조를 유지한다.

## Evidence on Hand

기획 문서 `MVP 기획안 (양식).docx`. 실제 사용자 테스트, 벤치마크, 고객 로고, 정확도 수치는 없다. 데모 숫자는 합성으로 표시하고 상업적 정확도 주장은 만들지 않는다.

## Product Principles

1. 결과는 참고용이며 한계를 먼저 말한다.
2. 점수만 주지 않고 의심 구간과 근거를 같이 보여 준다.
3. 업로드부터 결과까지 한 흐름으로 끝낸다.
4. 없는 정확도, 고객, 벤치마크를 지어내지 않는다.
5. 한국어로, 설명 없이 쓸 수 있어야 한다.

## Accessibility & Inclusion

키보드로 업로드와 분석 시작이 가능해야 하고, 점수와 경고는 색만으로 구분하지 않는다.
