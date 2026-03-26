# 다아라 (Daara) — AI 타로 & 운세 상담

Claude API를 활용한 AI 타로·운세 상담 웹앱입니다.

## 기능
- 🃏 **AI 타로 상담** — 78장 풀 덱 타로 카드 (메이저 22장 + 마이너 56장)
- 🌅 **오늘의 운세** — 별자리 기반 종합 운세
- ✋ **손금 분석** — Claude Vision으로 손금 사진 분석
- ⭐ **별자리 운세** — 12별자리 맞춤 운세
- 💕 **궁합 보기** — 두 별자리 궁합 분석
- 💰 **금전 운세** — 재물운 타로 + 별자리 분석

## 배포 방법

### 1. GitHub에 푸시
```bash
cd daara
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/daara.git
git push -u origin main
```

### 2. Vercel 배포
1. [vercel.com](https://vercel.com)에서 GitHub 저장소 연결
2. **Environment Variables** 설정:
   - `ANTHROPIC_API_KEY` = 본인의 Anthropic API 키
3. Deploy 클릭

### 3. 로컬 개발
```bash
# Vercel CLI 설치
npm i -g vercel

# .env.local 파일 생성
echo "ANTHROPIC_API_KEY=your-key-here" > .env.local

# 로컬 실행
vercel dev
```

## 프로젝트 구조
```
daara/
├── api/
│   └── chat.js          # Vercel Serverless 프록시 (API 키 보호)
├── public/
│   └── index.html       # 프론트엔드 (싱글 페이지)
├── vercel.json          # Vercel 라우팅 설정
├── package.json
└── .gitignore
```

## 보안
- API 키는 Vercel 환경변수에 저장 (프론트엔드 노출 없음)
- Serverless 프록시에서 모델/토큰 제한 적용
- XSS 방어 처리 (사용자 입력 이스케이프)
