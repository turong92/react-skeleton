import { describe, expect, it } from 'vitest'
import { loginIdProblemText } from './loginId'
import { defaultAuthLabels as en } from './labels'
import { koAuthLabels as ko } from './labels.ko'
import { loginIdProblem } from '../account/loginIdRules'

/* 설계 §13.2 의 표 — 키 이름과 문구 그대로 */
const rules = { minLength: 4, maxLength: 20 }

describe('login id wording (design §13.2)', () => {
  it('plain strings, both languages', () => {
    const plain: Array<[string, string, string]> = [
      ['loginId', '아이디', 'Username'],
      ['problemLoginIdMissing', '아이디를 입력해 주세요', 'Enter a username'],
      [
        'problemLoginIdChars',
        '영문 · 숫자 · 마침표(.) · 하이픈(-) · 밑줄(_)만 쓸 수 있어요',
        'Use only letters, numbers, periods, hyphens and underscores',
      ],
      [
        'problemLoginIdSymbols',
        '기호로 시작하거나 끝날 수 없고, 기호를 연달아 쓸 수 없어요',
        'It cannot start or end with a symbol, and symbols cannot sit next to each other',
      ],
      [
        'problemLoginIdDigitsOnly',
        '숫자만으로는 정할 수 없어요. 영문을 하나 넣어 주세요',
        'It cannot be numbers only — add a letter',
      ],
      ['loginIdChecking', '확인하는 중…', 'Checking…'],
      ['loginIdAvailable', '쓸 수 있는 아이디예요', 'This username is available'],
      [
        'errorLoginIdTaken',
        '이미 쓰고 있거나 쓸 수 없는 아이디예요',
        'This username is taken or not available',
      ],
      [
        'loginIdCheckUnknown',
        '지금은 확인할 수 없어요. 내면 확인해 드려요.',
        "We can't check right now — it will be checked when you submit.",
      ],
      [
        'loginIdRetryHint',
        '그 사이 다른 분이 이 아이디를 정했어요. 다른 아이디를 적어 주세요. 인증번호는 다시 받지 않아도 돼요.',
        'Someone took this username meanwhile. Pick another one — you do not need a new code.',
      ],
      ['signInIdentifier', '아이디 또는 이메일', 'Username or email'],
      [
        'problemIdentifierMissing',
        '아이디 또는 이메일을 입력해 주세요',
        'Enter your username or email',
      ],
      ['forgotLoginIdLink', '아이디 찾기', 'Forgot your username?'],
      ['forgotLoginIdTitle', '아이디 찾기', 'Find your username'],
      [
        'forgotLoginIdSubtitle',
        '가입한 이메일을 적으면 그 주소로 아이디를 보내 드려요.',
        'Enter your account email and we will send your username there.',
      ],
      ['forgotLoginIdSubmit', '아이디 보내기', 'Send my username'],
      ['loginIdRequiredTitle', '아이디를 정해 주세요', 'Choose your username'],
      [
        'loginIdRequiredBody',
        '로그인할 때와 문의할 때 쓰는, 바뀌지 않는 내 계정 이름이에요. 다른 사람에게는 보이지 않아요.',
        'The name of your account that never changes — for signing in and for support. Nobody else sees it.',
      ],
      ['loginIdRequiredSubmit', '이 아이디로 정하기', 'Use this username'],
      ['loginIdConfirmBody', '정한 뒤에는 바꿀 수 없어요.', 'You cannot change it afterwards.'],
      ['loginIdConfirm', '정하기', 'Confirm'],
      ['loginIdConfirmBack', '다시 입력', 'Edit'],
      ['settingsLoginIdFixed', '바꿀 수 없어요', 'Cannot be changed'],
      ['settingsLoginIdSetPassword', '비밀번호 만들기', 'Set a password'],
      ['settingsLoginIdAddEmail', '이메일 등록하기', 'Register an email'],
      [
        'emailRequiredWriteTitle',
        '글을 쓰려면 이메일을 등록해 주세요',
        'Register an email to post',
      ],
      [
        'emailRequiredWriteBody',
        '읽기는 지금처럼 할 수 있어요. 글 · 댓글 · 반응을 남기려면 이메일이 필요해요. 다른 사람에게는 보이지 않아요.',
        'You can keep reading. To post, comment or react you need an email. Nobody else sees it.',
      ],
      ['emailRequiredLater', '나중에 하기', 'Not now'],
      [
        'emailRequiredWriteNotice',
        '이메일을 등록하면 글을 쓸 수 있어요',
        'Register an email to start posting',
      ],
      ['emailRequiredWriteNoticeAction', '이메일 등록', 'Register email'],
      [
        'emailRequiredDeclined',
        '이메일을 등록한 뒤에 쓸 수 있어요',
        'You can post after registering an email',
      ],
      [
        'settingsEmailToWrite',
        '이메일을 등록하면 글을 쓸 수 있어요.',
        'Register an email to start posting.',
      ],
    ]
    for (const [key, koText, enText] of plain) {
      expect((ko as Record<string, unknown>)[key], `ko.${key}`).toBe(koText)
      expect((en as Record<string, unknown>)[key], `en.${key}`).toBe(enText)
    }
  })

  it('sentences with a blank take it as an argument ({min} {max} {id} {email} {provider})', () => {
    expect(ko.loginIdHint(4, 20)).toBe(
      '영문 · 숫자 · 마침표(.) · 하이픈(-) · 밑줄(_), 4~20자. 대문자는 소문자로 저장돼요. 다른 사람에게 보이지 않고, 한 번 정하면 바꿀 수 없어요.',
    )
    expect(en.loginIdHint(4, 20)).toBe(
      'Letters, numbers, periods, hyphens and underscores, 4–20 characters. Capitals are saved as lowercase. Nobody else sees it, and it cannot be changed later.',
    )
    expect(ko.problemLoginIdSize(4, 20)).toBe('아이디는 4~20자로 정해 주세요')
    expect(en.problemLoginIdSize(4, 20)).toBe('Use 4 to 20 characters')
    expect(ko.loginIdSavedAs('sumin.kim')).toBe('sumin.kim (으)로 저장돼요')
    expect(en.loginIdSavedAs('sumin.kim')).toBe('It will be saved as sumin.kim')
    expect(ko.forgotLoginIdSentBody('a@x.y')).toBe('a@x.y 에 계정이 있다면 아이디를 보냈어요.')
    expect(en.forgotLoginIdSentBody('a@x.y')).toBe(
      'If a@x.y has an account, we have sent the username there.',
    )
    expect(ko.loginIdConfirmTitle('sumin.kim')).toBe('sumin.kim (으)로 정할까요?')
    expect(en.loginIdConfirmTitle('sumin.kim')).toBe('Use sumin.kim?')
    expect(ko.settingsLoginIdNoPassword('Google')).toBe(
      '지금은 Google(으)로 로그인해요. 비밀번호를 만들면 아이디나 이메일로도 로그인할 수 있어요.',
    )
    expect(en.settingsLoginIdNoPassword('Google')).toBe(
      'You sign in with Google now. Set a password to sign in with your username or email too.',
    )
    expect(ko.emailRequiredReauthLosesDraft('Google')).toBe(
      'Google(으)로 다녀오면 지금 쓰던 내용은 사라져요.',
    )
    expect(en.emailRequiredReauthLosesDraft('Google')).toBe(
      'Going to Google discards what you were writing.',
    )
    expect(ko.emailRequiredDiscardConfirmLoginId('sumin.kim')).toBe(
      '아이디 sumin.kim 도 함께 사라지고 다시 쓸 수 없어요.',
    )
    expect(en.emailRequiredDiscardConfirmLoginId('sumin.kim')).toBe(
      'The username sumin.kim goes with it and can never be used again.',
    )
  })
})

describe('loginIdProblemText — one sentence per kind of problem', () => {
  it('missing · size · chars · symbols · digits only', () => {
    expect(loginIdProblemText('missing', rules, en)).toBe(en.problemLoginIdMissing)
    expect(loginIdProblemText('size', rules, en)).toBe('Use 4 to 20 characters')
    expect(loginIdProblemText('size', { minLength: 3, maxLength: 12 }, ko)).toBe(
      '아이디는 3~12자로 정해 주세요',
    )
    expect(loginIdProblemText('chars', rules, ko)).toBe(ko.problemLoginIdChars)
    expect(loginIdProblemText('symbols', rules, ko)).toBe(ko.problemLoginIdSymbols)
    expect(loginIdProblemText('digitsOnly', rules, ko)).toBe(ko.problemLoginIdDigitsOnly)
  })
  it('every kind the rule function can return has a different sentence', () => {
    const kinds = ['', 'ab', 'a b c', '.abcd', '12345'].map((v) => loginIdProblem(v, rules)!)
    const sentences = kinds.map((kind) => loginIdProblemText(kind, rules, en))
    expect(new Set(sentences).size).toBe(5)
  })
})
