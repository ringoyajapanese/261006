export interface Sentence { id: string; japanese: string; reading: string; meaning: string }
export interface Situation { id: string; name: string; sentences: Sentence[] }
export const situations: Situation[] = [
  { id: 'meeting', name: '처음 만났을 때', sentences: [
    { id: 'meeting-hello', japanese: 'はじめまして。よろしくお願いします。', reading: 'はじめまして。よろしく おねがいします。', meaning: '처음 뵙겠습니다. 잘 부탁드립니다.' },
    { id: 'meeting-korea', japanese: '私は韓国から来ました。', reading: 'わたしは かんこくから きました。', meaning: '저는 한국에서 왔습니다.' },
    { id: 'meeting-study', japanese: '日本語を勉強しています。', reading: 'にほんごを べんきょうしています。', meaning: '일본어를 공부하고 있습니다.' },
  ] },
  { id: 'cafe', name: '카페에서', sentences: [
    { id: 'cafe-coffee', japanese: 'コーヒーを一つください。', reading: 'コーヒーを ひとつ ください。', meaning: '커피 한 잔 주세요.' },
    { id: 'cafe-recommend', japanese: 'おすすめは何ですか。', reading: 'おすすめは なんですか。', meaning: '추천 메뉴는 무엇인가요?' },
    { id: 'cafe-here', japanese: 'ここで飲んでもいいですか。', reading: 'ここで のんでも いいですか。', meaning: '여기서 마셔도 될까요?' },
  ] },
  { id: 'directions', name: '길을 물어볼 때', sentences: [
    { id: 'directions-station', japanese: 'すみません、駅はどこですか。', reading: 'すみません、えきは どこですか。', meaning: '실례합니다. 역은 어디인가요?' },
    { id: 'directions-walk', japanese: 'ここから歩いて行けますか。', reading: 'ここから あるいて いけますか。', meaning: '여기서 걸어서 갈 수 있나요?' },
    { id: 'directions-thanks', japanese: '教えてくれて、ありがとうございます。', reading: 'おしえてくれて、ありがとうございます。', meaning: '알려 주셔서 감사합니다.' },
  ] },
  { id: 'day', name: '나의 하루', sentences: [
    { id: 'day-morning', japanese: '毎朝、七時に起きます。', reading: 'まいあさ、しちじに おきます。', meaning: '매일 아침 7시에 일어납니다.' },
    { id: 'day-music', japanese: '休みの日は音楽を聴きます。', reading: 'やすみの ひは おんがくを ききます。', meaning: '쉬는 날에는 음악을 듣습니다.' },
    { id: 'day-fun', japanese: '今日はとても楽しかったです。', reading: 'きょうは とても たのしかったです。', meaning: '오늘은 정말 즐거웠습니다.' },
  ] },
];
