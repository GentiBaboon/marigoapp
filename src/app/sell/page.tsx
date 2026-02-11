import { PriceSuggestionForm } from '@/components/sell/price-suggestion-form';

export default function SellPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            Sell Your Luxury Item
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Unsure about the price? Describe your item and our AI will suggest a
            competitive market price for you.
          </p>
        </div>
        <PriceSuggestionForm />
      </div>
    </div>
  );
}
