'use client';
import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { SignatureCanvas } from '@/components/courier/SignatureCanvas';
import type { FirestoreDelivery } from '@/lib/types';
import { Camera, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import imageCompression from 'browser-image-compression';

interface ConfirmPickupStepProps {
  delivery: FirestoreDelivery;
}

export function ConfirmPickupStep({ delivery }: ConfirmPickupStepProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const signatureRef = React.useRef<{
    toDataURL: () => string;
    clear: () => void;
  }>(null);

  const [hasCameraPermission, setHasCameraPermission] = React.useState(true);
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description:
            'Please enable camera permissions in your browser settings.',
        });
      }
    };

    if (!capturedImage) {
      getCameraPermission();
    }

    return () => {
      // Stop camera stream when component unmounts or photo is taken
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [capturedImage, toast]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleConfirmPickup = async () => {
    if (!capturedImage) {
      toast({
        variant: 'destructive',
        title: 'Photo Required',
        description: 'Please take a photo of the package.',
      });
      return;
    }
    if (signatureRef.current?.toDataURL() === 'data:image/png;base64,') {
      toast({
        variant: 'destructive',
        title: 'Signature Required',
        description: 'Please obtain the seller\'s signature.',
      });
      return;
    }

    setIsSubmitting(true);
    const signatureDataUrl = signatureRef.current?.toDataURL();
    
    // Compress the captured image before submitting
    const imageFile = await (await fetch(capturedImage)).blob();
    const compressedFile = await imageCompression(imageFile, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1200,
    });
    const compressedDataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(compressedFile);
    });

    const deliveryRef = doc(firestore, 'deliveries', delivery.id);

    try {
      await updateDoc(deliveryRef, {
        status: 'picked_up',
        proofOfPickup: compressedDataUrl,
        pickupSignature: signatureDataUrl,
        pickupNotes: notes,
      });
      toast({
        title: 'Pickup Confirmed!',
        description: "You're now ready to deliver the item.",
      });
      // The parent component will re-render and show the next step
    } catch (error) {
      console.error('Error confirming pickup:', error);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: 'Could not confirm pickup. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Confirm Pickup</CardTitle>
          <CardDescription>
            Take a photo of the package and get the seller's signature.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Photo Section */}
          <div>
            <h3 className="font-semibold mb-2">Package Photo (Required)</h3>
            <div className="relative w-full aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center">
              {capturedImage ? (
                <Image
                  src={capturedImage}
                  alt="Package photo"
                  fill
                  className="object-contain"
                />
              ) : (
                <video
                  ref={videoRef}
                  className="w-full aspect-video rounded-md"
                  autoPlay
                  muted
                />
              )}
            </div>
            {!hasCameraPermission && (
              <Alert variant="destructive" className="mt-2">
                <AlertTitle>Camera Access Required</AlertTitle>
                <AlertDescription>
                  Please allow camera access to use this feature.
                </AlertDescription>
              </Alert>
            )}
            {capturedImage ? (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => setCapturedImage(null)}
              >
                Retake Photo
              </Button>
            ) : (
              <Button
                className="w-full mt-2"
                onClick={handleCapture}
                disabled={!hasCameraPermission}
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Signature Section */}
          <div>
            <h3 className="font-semibold mb-2">Seller Signature (Required)</h3>
            <SignatureCanvas ref={signatureRef} />
          </div>

          {/* Notes Section */}
          <div>
            <h3 className="font-semibold mb-2">Notes (Optional)</h3>
            <Textarea
              placeholder="Add any notes about the pickup..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Action Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleConfirmPickup}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Check className="mr-2 h-4 w-4" />
            Confirm Pickup
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
