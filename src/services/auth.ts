import { auth } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';

export interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hardened Authentication Service
 * Strictly authenticates against Firebase Auth with encrypted credential verification.
 * Zero hardcoded passwords or mock bypasses.
 */
export const loginWithEmail = async (email: string, pass: string) => {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !pass) {
    return { success: false, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' };
  }

  try {
    const userCred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    
    // Store public session token metadata for client hydration
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'aman_auth_session',
        JSON.stringify({
          email: cleanEmail,
          uid: userCred.user.uid,
          name: userCred.user.displayName || cleanEmail.split('@')[0],
          timestamp: Date.now()
        })
      );
    }
    
    return { success: true, user: userCred.user, message: 'تم تسجيل الدخول بنجاح' };
  } catch (err: any) {
    let msg = 'فشل تسجيل الدخول، يرجى التأكد من صحة البيانات';
    
    if (
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/wrong-password' ||
      err.code === 'auth/invalid-credential'
    ) {
      msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'صيغة البريد الإلكتروني غير صالحة';
    } else if (err.code === 'auth/user-disabled') {
      msg = 'تم تعطيل هذا الحساب من قبل إدارة النظام';
    } else if (err.code === 'auth/too-many-requests') {
      msg = 'تم حظر المحاولات مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى المحاولة لاحقاً';
    } else if (err.code === 'auth/network-request-failed') {
      msg = 'تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت';
    } else if (err.code === 'auth/unauthorized-domain') {
      msg = 'النطاق الحالي غير مصرح به في إعدادات خادم المصادقة';
    }
    
    return { success: false, error: msg, rawError: err };
  }
};

/**
 * Register New Employee User in Firebase Auth
 */
export const registerWithEmail = async (
  email: string,
  pass: string,
  fullName: string,
  role?: string
) => {
  const cleanEmail = email.trim().toLowerCase();
  
  if (!cleanEmail || !pass) {
    return { success: false, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' };
  }

  if (pass.length < 6) {
    return { success: false, error: 'كلمة المرور ضعيفة، يجب ألا تقل عن 6 أحرف أو أرقام' };
  }

  try {
    const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    return {
      success: true,
      user: userCred.user,
      message: `تم إنشاء حساب الموظف "${fullName}" بنجاح`
    };
  } catch (err: any) {
    let msg = 'فشل إنشاء الحساب بالنظام';

    if (err.code === 'auth/email-already-in-use') {
      msg = 'هذا البريد الإلكتروني مسجل سابقاً في النظام';
    } else if (err.code === 'auth/weak-password') {
      msg = 'كلمة المرور ضعيفة، يرجى استخدام كلمة مرور أكثر قوة';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'صيغة البريد الإلكتروني غير صالحة';
    }
    return { success: false, error: msg, rawError: err };
  }
};

/**
 * Send Password Reset Email
 */
export const resetPasswordWithEmail = async (email: string) => {
  const cleanEmail = email.trim().toLowerCase();
  
  if (!cleanEmail) {
    return { success: false, error: 'يرجى إدخال البريد الإلكتروني' };
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return {
      success: true,
      message: `تم إرسال رابط استعادة كلمة المرور بنجاح إلى (${cleanEmail})`
    };
  } catch (err: any) {
    let msg = 'فشل إرسال رابط استعادة كلمة المرور';
    if (err.code === 'auth/user-not-found') {
      msg = 'البريد الإلكتروني غير مسجل في النظام';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'صيغة البريد الإلكتروني غير صالحة';
    }
    return { success: false, error: msg, rawError: err };
  }
};

/**
 * Secure Logout
 */
export const logoutUser = async () => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aman_auth_session');
    }
    await firebaseSignOut(auth);
    return { success: true, message: 'تم تسجيل الخروج بنجاح' };
  } catch (err: any) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aman_auth_session');
    }
    return { success: false, error: err?.message || 'خطأ أثناء تسجيل الخروج' };
  }
};
