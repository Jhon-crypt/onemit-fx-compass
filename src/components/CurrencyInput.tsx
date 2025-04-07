
import React, { useState, KeyboardEvent, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, RefreshCw, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onSubmit: () => void;
  isLoading: boolean;
  autoFocus?: boolean;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ 
  label, 
  value, 
  onChange, 
  onSubmit,
  isLoading,
  autoFocus = false
}) => {
  const [inputValue, setInputValue] = useState<string>(value.toString());
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsError(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue) && numValue > 0) {
      onChange(numValue);
      onSubmit();
      showSavedIndicator();
    } else {
      setIsError(true);
    }
  };

  const showSavedIndicator = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  return (
    <Card className="fx-card relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" 
        aria-hidden="true"
      />
      <CardHeader className="pb-2 relative">
        <CardTitle className="text-lg font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type="number"
              value={inputValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              className={`text-lg ${isError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              placeholder="Enter rate"
              autoFocus={autoFocus}
              disabled={isLoading}
              min="0"
              step="0.01"
            />
            {isError && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertCircle className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Please enter a valid number</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
          <Button 
            onClick={handleSubmit} 
            className="gap-1.5 w-20 relative overflow-hidden"
            disabled={isLoading || isSaved}
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isSaved ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              "Apply"
            )}
            {!isLoading && !isSaved && (
              <span className="absolute inset-0 w-full h-full bg-white/10 transform scale-x-0 origin-left group-hover:scale-x-100 transition-transform" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          Press Enter or click Apply to set the rate
        </p>
      </CardContent>
    </Card>
  );
};

export default CurrencyInput;
