import { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Loader2, Mail, Lock, User, Sparkles, Chrome } from 'lucide-react';
import { UserProfile } from '../types';

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if profile exists
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      if (!profileDoc.exists()) {
        const initialProfile: UserProfile = {
          uid: user.uid,
          email: user.email!,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          difficulty: 'easy',
          hasSeenOnboarding: false,
          createdAt: Date.now(),
        };
        await setDoc(doc(db, 'users', user.uid), initialProfile);
      }
    } catch (err: any) {
      console.error('Google Auth error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, don't show an error
        setError(null);
      } else {
        setError('Ошибка при входе через Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // LOGIN LOGIC
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Check if profile exists
        const profileDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (!profileDoc.exists()) {
          const initialProfile: UserProfile = {
            uid: userCredential.user.uid,
            email: userCredential.user.email!,
            displayName: userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'User',
            difficulty: 'easy',
            hasSeenOnboarding: false,
            createdAt: Date.now(),
          };
          await setDoc(doc(db, 'users', userCredential.user.uid), initialProfile);
        }
      } else {
        // REGISTRATION LOGIC
        if (!displayName.trim()) {
          throw new Error('Пожалуйста, введите ваше имя');
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await updateProfile(user, { displayName: displayName.trim() });

        const initialProfile: UserProfile = {
          uid: user.uid,
          email: user.email!,
          displayName: displayName.trim(),
          difficulty: 'easy',
          hasSeenOnboarding: false,
          createdAt: Date.now(),
        };

        await setDoc(doc(db, 'users', user.uid), initialProfile);
      }
    } catch (err: any) {
      console.error('Auth error detail:', err);
      
      if (err.code === 'auth/operation-not-allowed') {
        setError(
          <div className="space-y-2">
            <p className="font-bold">Вход по Email отключен в Firebase</p>
            <p className="text-xs">Вам нужно включить "Email/Password" в консоли Firebase:</p>
            <a 
              href="https://console.firebase.google.com/project/_/authentication/providers" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 underline block text-xs"
            >
              Открыть настройки Firebase
            </a>
            <p className="text-[10px] opacity-70">Или используйте вход через Google ниже.</p>
          </div>
        );
      } else {
        let message: React.ReactNode = 'Произошла ошибка при аутентификации';
        if (err.code === 'auth/email-already-in-use') {
          message = (
            <div className="space-y-1">
              <p>Этот email уже используется.</p>
              <button 
                type="button"
                onClick={() => setIsLogin(true)}
                className="text-blue-400 underline text-xs"
              >
                Попробуйте войти вместо регистрации
              </button>
            </div>
          );
        }
        else if (err.code === 'auth/invalid-email') message = 'Некорректный email';
        else if (err.code === 'auth/weak-password') message = 'Пароль слишком слабый (минимум 6 символов)';
        else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') message = 'Неверный email или пароль';
        else if (err.message) message = err.message;
        setError(message);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117] p-4">
      <Card className="w-full max-w-md bg-[#161922] border-slate-800 text-slate-200">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isLogin ? 'С возвращением' : 'Создать аккаунт'}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {isLogin ? 'Войдите в свой аккаунт, чтобы продолжить' : 'Зарегистрируйтесь, чтобы начать общение с ИИ'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/50 text-red-400 text-sm">
                {error}
              </div>
            )}
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Как к вам обращаться?</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <Input 
                    id="name" 
                    placeholder="Имя" 
                    className="pl-10 bg-slate-900 border-slate-700"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  className="pl-10 bg-slate-900 border-slate-700"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <Input 
                  id="password" 
                  type="password" 
                  className="pl-10 bg-slate-900 border-slate-700"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? 'Войти' : 'Зарегистрироваться'}
            </Button>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-800"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#161922] px-2 text-slate-500">Или</span>
              </div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full border-slate-700 hover:bg-slate-800 text-slate-200"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <Chrome className="mr-2 h-4 w-4" />
              Войти через Google
            </Button>

            <div className="text-sm text-center text-slate-400">
              {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-1 text-blue-400 hover:underline"
              >
                {isLogin ? 'Зарегистрироваться' : 'Войти'}
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
