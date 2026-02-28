'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MapPin, CreditCard, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useUser, useFirestore } from '@/firebase';
import type { FirestoreAddress } from '@/lib/types';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCurrency } from '@/context/CurrencyContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type SummaryStepProps = {
  onPrevStep: (step: number) => void;
  shippingAddress: FirestoreAddress | null;
  paymentMethod: string | null;
};

export function SummaryStep({ onPrevStep, shippingAddress, paymentMethod }: SummaryStepProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { items, grandTotal, clearCart } = useCart();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const stripe = useStripe();
  const elements = useElements();
  const functions = getFunctions();
  const { formatPrice } = useCurrency();
  
  const handlePay = async () => {
    if (!user || !firestore || !shippingAddress || !paymentMethod) {
        setErrorMsg("Informazioni mancanti: assicurati di aver selezionato indirizzo e pagamento.");
        return;
    }

    if (items.length === 0) {
        setErrorMsg("Il carrello è vuoto.");
        return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const orderPayload = {
        items: items.map(item => ({
            id: item.id,
            sellerId: item.sellerId,
            title: item.title,
            brand: item.brand,
            image: item.image,
            price: item.price,
            quantity: 1,
            size: item.selectedSize || null,
        })),
        shippingAddress: {
            fullName: shippingAddress.fullName,
            phone: shippingAddress.phone,
            address: shippingAddress.address,
            city: shippingAddress.city,
            postal: shippingAddress.postal,
            country: shippingAddress.country,
        },
    };

    try {
        if (paymentMethod === 'cod') {
            const createOrder = httpsCallable(functions, 'createOrder');
            const result: any = await createOrder(orderPayload);
            clearCart();
            router.push(`/checkout/success/${result.data.orderId}`);
            return;
        }

        if (!stripe || !elements) {
            throw new Error("Stripe non è pronto. Per favore ricarica la pagina.");
        }

        // 1. Chiama la Cloud Function per creare il PaymentIntent
        const createPaymentIntent = httpsCallable(functions, 'createPaymentIntent');
        const intentResult: any = await createPaymentIntent(orderPayload);
        const { clientSecret, orderId } = intentResult.data;
        
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) throw new Error("Campo carta non trovato.");

        // 2. Conferma il pagamento con Stripe (gestisce 3D Secure se necessario)
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: { card: cardElement },
        });

        if (stripeError) {
            throw new Error(stripeError.message);
        }

        if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture')) {
            clearCart();
            router.push(`/checkout/success/${orderId}`);
        } else {
             throw new Error(`Stato pagamento imprevisto: ${paymentIntent?.status}`);
        }

    } catch (error: any) {
        console.error("Detailed Checkout Error:", error);
        
        // Estrai il messaggio di errore reale dalla Firebase Function
        let message = "Errore durante il checkout.";
        if (error.message) {
            // Rimuovi il prefisso generico di Firebase se presente
            message = error.message.replace("internal, ", "");
        }
        
        setErrorMsg(message);
        toast({
            variant: 'destructive',
            title: 'Transazione fallita',
            description: message,
        });
    } finally {
        setIsLoading(false);
    }
  }

  const paymentMethodLabels: { [key: string]: string } = {
    cod: 'Contrassegno (Pagamento alla consegna)',
    new_card: 'Carta di Credito o Debito',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Riepilogo e Conferma</CardTitle>
          <CardDescription>
            Controlla i tuoi dati prima di procedere al pagamento sicuro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {errorMsg && (
              <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Errore</AlertTitle>
                  <AlertDescription className="font-medium">{errorMsg}</AlertDescription>
              </Alert>
          )}

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-start gap-4">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="flex-1">
                      <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Indirizzo di spedizione</h4>
                      {shippingAddress ? (
                          <div className="text-sm mt-1">
                              <p className="font-bold">{shippingAddress.fullName}</p>
                              <p>{shippingAddress.address}, {shippingAddress.city}</p>
                              <p>{shippingAddress.postal}, {shippingAddress.country}</p>
                          </div>
                      ) : (
                          <p className="text-sm text-destructive">Nessun indirizzo selezionato.</p>
                      )}
                  </div>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onPrevStep(1)}>Modifica</Button>
              </div>
              <Separator />
              <div className="flex items-start gap-4">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="flex-1">
                      <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Metodo di pagamento</h4>
                      <p className="text-sm mt-1">{paymentMethod ? paymentMethodLabels[paymentMethod] : 'Nessuno selezionato'}</p>
                  </div>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onPrevStep(2)}>Modifica</Button>
              </div>
          </div>
          
          <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
              Cliccando su "Paga ora", accetti i nostri <a href="#" className="underline">Termini di Servizio</a>. I fondi saranno trattenuti in sicurezza e rilasciati al venditore solo dopo la consegna.
          </p>

        </CardContent>
        <CardFooter className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full bg-black text-white hover:bg-black/90 h-14 text-base font-bold shadow-xl"
              onClick={handlePay}
              disabled={isLoading || !shippingAddress || !paymentMethod}
            >
              {isLoading ? (
                  <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Elaborazione...</span>
                  </div>
              ) : (
                  `Paga ora ${formatPrice(grandTotal)}`
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => onPrevStep(2)}
              disabled={isLoading}
            >
              Indietro
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}