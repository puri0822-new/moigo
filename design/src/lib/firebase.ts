import type { Auth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export interface FirebaseAuth {
  auth: Auth;
  googleProvider: GoogleAuthProvider;
  signInWithPopup: typeof signInWithPopup;
  signOut: typeof signOut;
}

let loading: Promise<FirebaseAuth> | null = null;

/** Firebase는 구글 로그인에만 쓰는데 번들에서 가장 큰 편이라, 처음 화면을 그릴 때 받지 않고 필요할 때 따로 받는다.
 *  로그인 화면이 열리면 미리 불러 두어서, 버튼을 누른 뒤 기다리느라 팝업이 차단되지 않게 한다. */
export function loadFirebaseAuth(): Promise<FirebaseAuth> {
  if (!loading) {
    loading = Promise.all([import('firebase/app'), import('firebase/auth')]).then(([appMod, authMod]) => {
      const app = appMod.initializeApp(firebaseConfig);
      return {
        auth: authMod.getAuth(app),
        googleProvider: new authMod.GoogleAuthProvider(),
        signInWithPopup: authMod.signInWithPopup,
        signOut: authMod.signOut,
      };
    });
    // 네트워크 오류로 실패했으면 다음 호출 때 다시 받는다
    loading.catch(() => { loading = null; });
  }
  return loading;
}
