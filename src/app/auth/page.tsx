'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { SocialButtons } from '@/components/auth/social-buttons';
import { useUser } from '@/firebase';
import { useEffect } from 'react';
import { useI18n } from '@/hooks/use-i18n';

export default function AuthGatePage() {
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const bgImage = PlaceHolderImages.find(p => p.id === 'home-hero');
    const { t } = useI18n();

    useEffect(() => {
        if (!isUserLoading && user) {
            router.replace('/home');
        }
    }, [user, isUserLoading, router]);


    if (isUserLoading || user) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="dot-flashing"></div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen w-full text-white bg-black">
            {bgImage && (
                 <Image
                    src={bgImage.imageUrl}
                    alt="Fashion models"
                    fill
                    className="object-cover opacity-50"
                    priority
                    data-ai-hint="luxury fashion"
                 />
            )}
            
            <div className="absolute inset-0 flex flex-col justify-end p-8 space-y-5">
                <div className="text-center mb-4">
                    <h1 className="text-4xl font-bold font-logo">marigo</h1>
                    <p className="mt-2 text-lg">{t('Auth.authGateTitle')}</p>
                </div>
                
                <SocialButtons variant="default" className="bg-white text-black hover:bg-gray-200" />
                
                <Button asChild variant="outline" className="w-full border-white text-white bg-transparent hover:bg-white hover:text-black">
                    <Link href="/auth/signup">
                        {t('Auth.registerWithEmail')}
                    </Link>
                </Button>
                
                <div className="text-center text-sm">
                    {t('Auth.alreadyHaveAccount')}{' '}
                    <Link href="/auth/login" className="underline font-semibold">
                        {t('Auth.login')}
                    </Link>
                </div>

                <div className="text-center">
                    <Button variant="link" className="text-white/80 hover:text-white" onClick={() => router.replace('/home')}>
                        {t('Auth.registerLater')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
    