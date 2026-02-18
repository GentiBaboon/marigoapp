'use client';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from '../ui/button';
import type { FirestoreProduct } from '@/lib/types';

interface AuthenticityBadgeProps {
  authenticityCheck?: FirestoreProduct['authenticityCheck'];
}

export function AuthenticityBadge({ authenticityCheck }: AuthenticityBadgeProps) {
  if (!authenticityCheck || authenticityCheck.status !== 'completed') {
    return null;
  }

  const { confidence, findings } = authenticityCheck;

  const config = {
    high: {
      icon: <ShieldCheck className="h-5 w-5 text-green-600" />,
      text: 'High Authenticity Confidence',
      variant: 'default',
      className: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-100',
    },
    medium: {
      icon: <ShieldAlert className="h-5 w-5 text-yellow-600" />,
      text: 'Medium Authenticity Confidence',
      variant: 'secondary',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100',
    },
    low: {
      icon: <Shield className="h-5 w-5 text-gray-600" />,
      text: 'Authenticity Pre-Check',
      variant: 'outline',
      className: 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-100',
    },
  }[confidence];

  if (!config) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
            <Badge variant={config.variant} className={config.className}>
                {config.icon}
                <span className="ml-1.5">{config.text}</span>
            </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-4 bg-background border shadow-lg rounded-lg" side="bottom" align="start">
          <div className="space-y-3">
            <p className="font-semibold text-foreground">AI Pre-Check Findings</p>
            {findings && findings.length > 0 && (
              <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
                {findings.map((finding, index) => (
                  <li key={index}>{finding}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground pt-2">
                Disclaimer: This is an AI-powered pre-check and not a substitute for professional authentication.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
