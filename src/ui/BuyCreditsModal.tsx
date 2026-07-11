import { X, CircleStop, Loader2, Sparkle, ShieldCheck, CheckCircle2, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import Notification from './Notification.tsx';
import TiltedCard from './TiltedCard.tsx';
import PlanIcon from './PlanIcon.tsx';
import { useUserProfile } from '../lib/UserContext.tsx';
import { fontSize } from '../lib/utils';
import { useTheme } from '../lib/ThemeContext.tsx';
import { supabase } from '../services/supabase';

interface BuyCreditsModalProps {
  onClose: () => void;
  userId?: string;
  onPaymentSuccess: (credits: number) => void;
  currentPlan?: string;
  isPremium?: boolean;
  premiumEnds?: string;
  refreshProfile?: () => Promise<void>;
}

const countries = [
  { code: 'AL', name: 'Albania', currency: 'ALL', symbol: 'L' },
  { code: 'DZ', name: 'Algeria', currency: 'DZD', symbol: 'د.ج' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', symbol: '$' },
  { code: 'AM', name: 'Armenia', currency: 'AMD', symbol: '֏' },
  { code: 'AU', name: 'Australia', currency: 'AUD', symbol: 'A$' },
  { code: 'AT', name: 'Austria', currency: 'EUR', symbol: '€' },
  { code: 'AZ', name: 'Azerbaijan', currency: 'AZN', symbol: '₼' },
  { code: 'BS', name: 'Bahamas', currency: 'BSD', symbol: 'B$' },
  { code: 'BH', name: 'Bahrain', currency: 'BHD', symbol: 'BD' },
  { code: 'BB', name: 'Barbados', currency: 'BBD', symbol: 'Bds$' },
  { code: 'BY', name: 'Belarus', currency: 'BYN', symbol: 'Br' },
  { code: 'BE', name: 'Belgium', currency: 'EUR', symbol: '€' },
  { code: 'BA', name: 'Bosnia', currency: 'BAM', symbol: 'KM' },
  { code: 'BW', name: 'Botswana', currency: 'BWP', symbol: 'P' },
  { code: 'BR', name: 'Brazil', currency: 'BRL', symbol: 'R$' },
  { code: 'BG', name: 'Bulgaria', currency: 'BGN', symbol: 'лв' },
  { code: 'CA', name: 'Canada', currency: 'CAD', symbol: 'C$' },
  { code: 'CL', name: 'Chile', currency: 'CLP', symbol: '$' },
  { code: 'CN', name: 'China', currency: 'CNY', symbol: '¥' },
  { code: 'CO', name: 'Colombia', currency: 'COP', symbol: '$' },
  { code: 'CR', name: 'Costa Rica', currency: 'CRC', symbol: '₡' },
  { code: 'HR', name: 'Croatia', currency: 'EUR', symbol: '€' },
  { code: 'CU', name: 'Cuba', currency: 'CUP', symbol: '$' },
  { code: 'CZ', name: 'Czech Republic', currency: 'CZK', symbol: 'Kč' },
  { code: 'DK', name: 'Denmark', currency: 'DKK', symbol: 'kr' },
  { code: 'DO', name: 'Dominican Republic', currency: 'DOP', symbol: 'RD$' },
  { code: 'EC', name: 'Ecuador', currency: 'USD', symbol: '$' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', symbol: '£' },
  { code: 'EE', name: 'Estonia', currency: 'EUR', symbol: '€' },
  { code: 'ET', name: 'Ethiopia', currency: 'ETB', symbol: 'Br' },
  { code: 'FI', name: 'Finland', currency: 'EUR', symbol: '€' },
  { code: 'FR', name: 'France', currency: 'EUR', symbol: '€' },
  { code: 'GE', name: 'Georgia', currency: 'GEL', symbol: '₾' },
  { code: 'DE', name: 'Germany', currency: 'EUR', symbol: '€' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', symbol: '₵' },
  { code: 'GR', name: 'Greece', currency: 'EUR', symbol: '€' },
  { code: 'GT', name: 'Guatemala', currency: 'GTQ', symbol: 'Q' },
  { code: 'GY', name: 'Guyana', currency: 'GYD', symbol: '$' },
  { code: 'HT', name: 'Haiti', currency: 'HTG', symbol: 'G' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD', symbol: '$' },
  { code: 'HU', name: 'Hungary', currency: 'HUF', symbol: 'Ft' },
  { code: 'IS', name: 'Iceland', currency: 'ISK', symbol: 'kr' },
  { code: 'IN', name: 'India', currency: 'INR', symbol: '₹' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', symbol: 'Rp' },
  { code: 'IR', name: 'Iran', currency: 'IRR', symbol: '﷼' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', symbol: '€' },
  { code: 'IL', name: 'Israel', currency: 'ILS', symbol: '₪' },
  { code: 'IT', name: 'Italy', currency: 'EUR', symbol: '€' },
  { code: 'JM', name: 'Jamaica', currency: 'JMD', symbol: 'J$' },
  { code: 'JP', name: 'Japan', currency: 'JPY', symbol: '¥' },
  { code: 'JO', name: 'Jordan', currency: 'JOD', symbol: 'د.ا' },
  { code: 'KZ', name: 'Kazakhstan', currency: 'KZT', symbol: '₸' },
  { code: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD', symbol: 'د.ك' },
  { code: 'LV', name: 'Latvia', currency: 'EUR', symbol: '€' },
  { code: 'LB', name: 'Lebanon', currency: 'LBP', symbol: 'ل.ل' },
  { code: 'LT', name: 'Lithuania', currency: 'EUR', symbol: '€' },
  { code: 'LY', name: 'Libya', currency: 'LYD', symbol: 'ل.د' },
  { code: 'LU', name: 'Luxembourg', currency: 'EUR', symbol: '€' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', symbol: 'RM' },
  { code: 'MX', name: 'Mexico', currency: 'MXN', symbol: '$' },
  { code: 'MK', name: 'North Macedonia', currency: 'MKD', symbol: 'ден' },
  { code: 'NO', name: 'Norway', currency: 'NOK', symbol: 'kr' },
  { code: 'NP', name: 'Nepal', currency: 'NPR', symbol: '₨' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', symbol: '€' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', symbol: '$' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR', symbol: '₨' },
  { code: 'PA', name: 'Panama', currency: 'USD', symbol: '$' },
  { code: 'PE', name: 'Peru', currency: 'PEN', symbol: 'S/' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', symbol: '₱' },
  { code: 'PL', name: 'Poland', currency: 'PLN', symbol: 'zł' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', symbol: '€' },
  { code: 'QA', name: 'Qatar', currency: 'QAR', symbol: '﷼' },
  { code: 'RO', name: 'Romania', currency: 'RON', symbol: 'lei' },
  { code: 'RU', name: 'Russia', currency: 'RUB', symbol: '₽' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', symbol: '﷼' },
  { code: 'RS', name: 'Serbia', currency: 'RSD', symbol: 'дин' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', symbol: 'S$' },
  { code: 'SK', name: 'Slovakia', currency: 'EUR', symbol: '€' },
  { code: 'SI', name: 'Slovenia', currency: 'EUR', symbol: '€' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R' },
  { code: 'KR', name: 'South Korea', currency: 'KRW', symbol: '₩' },
  { code: 'ES', name: 'Spain', currency: 'EUR', symbol: '€' },
  { code: 'LK', name: 'Sri Lanka', currency: 'LKR', symbol: 'Rs' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', symbol: 'kr' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', symbol: 'Fr' },
  { code: 'TW', name: 'Taiwan', currency: 'TWD', symbol: 'NT$' },
  { code: 'TH', name: 'Thailand', currency: 'THB', symbol: '฿' },
  { code: 'TN', name: 'Tunisia', currency: 'TND', symbol: 'د.ت' },
  { code: 'TR', name: 'Turkey', currency: 'TRY', symbol: '₺' },
  { code: 'UA', name: 'Ukraine', currency: 'UAH', symbol: '₴' },
  { code: 'AE', name: 'UAE', currency: 'AED', symbol: 'د.إ' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£' },
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$' },
  { code: 'UY', name: 'Uruguay', currency: 'UYU', symbol: '$' },
  { code: 'UZ', name: 'Uzbekistan', currency: 'UZS', symbol: "so'm" },
  { code: 'VE', name: 'Venezuela', currency: 'USD', symbol: '$' },
  { code: 'VN', name: 'Vietnam', currency: 'VND', symbol: '₫' },
  { code: 'YE', name: 'Yemen', currency: 'YER', symbol: '﷼' },
  { code: 'ZW', name: 'Zimbabwe', currency: 'USD', symbol: '$' },
];

const baseUSDPrices = {
  'Glix Lite': 4.99,
  'Glix Rise': 9.99,
  'Glix Peak': 19.99,
};

const indiaPricing = {
  'Glix Lite': { monthly: 299, yearly: 2990 },
  'Glix Rise': { monthly: 599, yearly: 5990 },
  'Glix Peak': { monthly: 999, yearly: 9990 },
};

const defaultFeatures = [
  "Limitless use with interactive export",
  "Custom profile and emoji anywhere",
  "HD video streaming & 4K support",
  "Priority 24/7 customer support",
  "Advanced analytics dashboard",
  "Early access to beta features"
];

const calculatePrice = (planName: string, countryCurrency: string, isYearly: boolean, rates: { [key: string]: number }): number => {
  if (planName === 'Free') return 0;

  if (countryCurrency === 'INR') {
    const pricing = indiaPricing[planName as keyof typeof indiaPricing];
    if (pricing) {
      return isYearly ? pricing.yearly : pricing.monthly;
    }
  }

  const basePriceUSD = baseUSDPrices[planName as keyof typeof baseUSDPrices];

  const rate = rates[countryCurrency] || 1;

  const multiplier = isYearly ? 10 : 1;

  const localPrice = basePriceUSD * rate * multiplier;

  if (countryCurrency === 'JPY' || countryCurrency === 'KRW' || countryCurrency === 'VND') {
    return Math.round(localPrice);
  } else if (countryCurrency === 'BHD' || countryCurrency === 'JOD' || countryCurrency === 'KWD') {
    return Math.round(localPrice * 1000) / 1000;
  }

  return Math.round(localPrice * 100) / 100;
};

const calculateOriginalPrice = (planName: string, countryCurrency: string, isYearly: boolean, rates: { [key: string]: number }): number => {
  if (planName === 'Free') return 0;

  const basePriceUSD = baseUSDPrices[planName as keyof typeof baseUSDPrices];
  const rate = rates[countryCurrency] || 1;
  const multiplier = isYearly ? 10 : 1;
  const localPrice = basePriceUSD * rate * multiplier;

  if (countryCurrency === 'JPY' || countryCurrency === 'KRW' || countryCurrency === 'VND') {
    return Math.round(localPrice);
  } else if (countryCurrency === 'BHD' || countryCurrency === 'JOD' || countryCurrency === 'KWD') {
    return Math.round(localPrice * 1000) / 1000;
  }

  return Math.round(localPrice * 100) / 100;
};

const getCurrencySymbol = (currency: string): string => {
  const country = countries.find(c => c.currency === currency);
  return country?.symbol || '$';
};

const basePricingTiers = {
  monthly: [
    { name: 'Free', creditsPerDay: 20, popular: false, totalCredits: 600, color: 'from-gray-600 to-gray-700', maxQuestions: 25, maxExamTypes: 5, maxSubjects: 3, maxFriends: 5, dailyChallenges: 3, dailyImports: 3 },
    { name: 'Glix Lite', creditsPerDay: 75, popular: false, totalCredits: 2250, color: 'from-blue-500 to-indigo-600', maxQuestions: 75, maxExamTypes: 10, maxSubjects: 5, maxFriends: 15, dailyChallenges: 10, dailyImports: 5 },
    { name: 'Glix Rise', creditsPerDay: 150, popular: true, totalCredits: 4500, color: 'from-indigo-600 to-purple-600', maxQuestions: 100, maxExamTypes: 15, maxSubjects: 8, maxFriends: 30, dailyChallenges: 15, dailyImports: 10 },
    { name: 'Glix Peak', creditsPerDay: 300, popular: false, totalCredits: 9000, color: 'from-pink-500 to-rose-600', maxQuestions: 125, maxExamTypes: 20, maxSubjects: 10, maxFriends: 50, dailyChallenges: 20, dailyImports: 15 },
  ],
  yearly: [
    { name: 'Glix Lite', creditsPerDay: 75, popular: false, totalCredits: 27000, color: 'from-blue-500 to-indigo-600', maxQuestions: 75, maxExamTypes: 10, maxSubjects: 5, maxFriends: 15, dailyChallenges: 10, dailyImports: 5 },
    { name: 'Glix Rise', creditsPerDay: 150, popular: true, totalCredits: 54000, color: 'from-indigo-600 to-purple-600', maxQuestions: 100, maxExamTypes: 15, maxSubjects: 8, maxFriends: 30, dailyChallenges: 15, dailyImports: 10 },
    { name: 'Glix Peak', creditsPerDay: 300, popular: false, totalCredits: 108000, color: 'from-pink-500 to-rose-600', maxQuestions: 125, maxExamTypes: 20, maxSubjects: 10, maxFriends: 50, dailyChallenges: 20, dailyImports: 15 },
  ],
};

export default function BuyCreditsModal({ onClose, userId, onPaymentSuccess, currentPlan, isPremium, premiumEnds, refreshProfile }: BuyCreditsModalProps) {
  const { userProfile } = useUserProfile();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [showUpgradeWarning, setShowUpgradeWarning] = useState(false);
  const [pendingTier, setPendingTier] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState<typeof countries[0] | null>(null);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>({});
  const [loadingRates, setLoadingRates] = useState(false);
  const [ratesLoaded, setRatesLoaded] = useState(false);

  useEffect(() => {
    const savedCountry = localStorage.getItem('glixup_country');
    let countryToSet = countries.find(c => c.code === 'US') || countries[0];

    if (savedCountry) {
      const country = countries.find(c => c.code === savedCountry);
      if (country) {
        countryToSet = country;
      }
    }

    setSelectedCountry(countryToSet);
  }, []);

  const handleCountryChange = (country: typeof countries[0]) => {
    setSelectedCountry(country);
    localStorage.setItem('glixup_country', country.code);
    setShowCountryDropdown(false);
  };

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  const fetchExchangeRates = async () => {
    setLoadingRates(true);
    try {
      const response = await fetch('https://raw.githubusercontent.com/X0U8/Exchange-rate/main/rates.json');
      const data = await response.json();

      if (data.rates) {
        const ratesWithUSD = { USD: 1, ...data.rates };
        setExchangeRates(ratesWithUSD);
        setRatesLoaded(true);
      } else {
        throw new Error('No rates in response');
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);

      const fallbackRates: { [key: string]: number } = {};

      countries.forEach(country => {
        fallbackRates[country.currency] = 1;
      });

      setExchangeRates(fallbackRates);
      setRatesLoaded(true);
    } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    fetchExchangeRates();
  }, []);

  const isPremiumActive = () => {
    if (!premiumEnds || !isPremium) return false;
    const endDate = new Date(premiumEnds);
    const now = new Date();
    return endDate > now;
  };

  const getTierLevel = (planName: string) => {
    const tierLevels: { [key: string]: number } = {
      'Free': 0,
      'Glix Lite': 1,
      'Glix Rise': 2,
      'Glix Peak': 3,
    };
    return tierLevels[planName] ?? 0;
  };

  const isCurrentPlan = (tierName: string) => {
    const planFromProps = currentPlan;
    const planFromStorage = userProfile?.PremiumType;
    const planToCheck = planFromProps || planFromStorage;

    if (!planToCheck) return false;

    const baseCurrentPlan = planToCheck.replace(/_month|_year|_monthly|_yearly$/, '');
    const currentPeriod = planToCheck.match(/(_month|_year|_monthly|_yearly)$/)?.[1] || '';

    const expectedPeriod = isYearly ? '_yearly' : '_monthly';
    const currentPeriodNormalized = currentPeriod.replace('_year', '_yearly').replace('_month', '_monthly');

    return baseCurrentPlan === tierName && currentPeriodNormalized === expectedPeriod;
  };

  const handlePurchaseClick = (tier: any) => {
    if (isPremiumActive() && !isCurrentPlan(tier.name)) {
      setPendingTier(tier);
      setShowUpgradeWarning(true);
    } else {
      handlePurchase(tier);
    }
  };

  const getPricingTiers = () => {
    if (!ratesLoaded) {
      return [];
    }

    const baseTiers = isYearly ? basePricingTiers.yearly : basePricingTiers.monthly;
    return baseTiers.map(tier => ({
      ...tier,
      price: calculatePrice(tier.name, selectedCountry?.currency || 'USD', isYearly, exchangeRates),
    }));
  };

  const pricingTiers = getPricingTiers();

  const handlePurchase = async (tier: any) => {
    if (!userId) {
      showNotification('error', 'Please log in to subscribe');
      return;
    }

    if (tier.price === 0) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || '';
        const updateResponse = await fetch('/api/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            userId,
            authToken: token,
            plan: tier.name,
            creditsPerDay: tier.creditsPerDay,
            period: 'month',
          }),
        });

        const updateData = await updateResponse.json();

        if (updateData.success) {
          if (refreshProfile) {
            await refreshProfile();
          }

          onPaymentSuccess(tier.creditsPerDay);
          onClose();
          showNotification('success', 'Free plan activated!');
        } else {
          showNotification('error', 'Failed to activate plan.');
        }
      } catch (error) {
        showNotification('error', 'Failed to activate plan.');
      }
      return;
    }

    setLoading(true);

    try {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: Math.round(tier.price * 100),
          currency: selectedCountry?.currency || 'USD',
          name: 'Wachsen',
          description: `${tier.name} - ${tier.creditsPerDay} credits/day (${isYearly ? 'Yearly' : 'Monthly'})`,
          order_id: '',
          handler: async function (response: any) {
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData.session?.access_token || '';
              const processResponse = await fetch('/api/subscription', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'process',
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  userId,
                  authToken: token,
                  amount: tier.price,
                  currency: selectedCountry?.currency || 'USD',
                  plan: tier.name,
                  creditsPerDay: tier.creditsPerDay,
                  period: isYearly ? 'year' : 'month',
                }),
              });

              const processData = await processResponse.json();

              if (processData.success) {
                if (refreshProfile) {
                  await refreshProfile();
                }

                onPaymentSuccess(tier.creditsPerDay);
                onClose();
                showNotification('success', 'Subscription activated successfully!');
              } else {
                showNotification('error', 'Subscription activation failed. Please contact support.');
              }
            } catch (error) {
              console.error('Subscription processing error:', error);
              showNotification('error', 'Subscription processing failed. Please contact support.');
            }
            setLoading(false);
          },
          prefill: {
            name: '',
            email: '',
            contact: '',
          },
          theme: {
            color: '#3b82f6',
          },
        };

        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
        razorpay.on('payment.failed', function (response: any) {
          console.error('Payment failed:', response);
          showNotification('error', 'Payment failed. Please try again.');
          setLoading(false);
        });
      };

      script.onerror = () => {
        showNotification('error', 'Failed to load payment gateway. Please try again.');
        setLoading(false);
      };
    } catch (error) {
      console.error('Payment error:', error);
      showNotification('error', 'Payment failed. Please try again.');
      setLoading(false);
    }
  };

  if (!selectedCountry || !ratesLoaded) {
    return (
      <div className="fixed inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
        <div className="bg-gray-100/50 dark:bg-gray-900/50 border border-black/10 dark:border-white/10 rounded-[3rem] p-8">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-500 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="fixed inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative bg-gray-100/50 dark:bg-gray-900/50 border border-black/10 dark:border-white/10 rounded-[3rem] w-full max-w-[1100px] shadow-2xl my-8 max-h-[90vh] overflow-y-auto">

          <div className="p-6 sm:p-10 pb-6 flex items-center justify-between">
            <div>
              <h2 className="text-gray-900 dark:text-white tracking-tight" style={{ fontSize: fontSize['3xl'] }}>
                Ready to <span className="text-blue-600 dark:text-blue-500">Level Up?</span>
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-3 sm:p-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all"
            >
              <X className="w-5 h-5 sm:w-7 sm:h-7" />
            </button>
          </div>

          <div className="px-8 pb-4 flex justify-center">
            <div className="relative">
              <button
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                className="flex items-center gap-2 bg-gray-200/40 dark:bg-black/40 hover:bg-gray-300/60 dark:hover:bg-black/60 rounded-xl px-4 py-2.5 border border-black/5 dark:border-white/5 transition-all"
              >
                <Globe className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-gray-900 dark:text-white" style={{ fontSize: fontSize.sm }}>{selectedCountry.name}</span>
                <span className="text-gray-500 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>({selectedCountry.currency})</span>
              </button>

              {showCountryDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-gray-100 dark:bg-gray-900 border border-black/10 dark:border-white/10 rounded-xl shadow-xl z-10 w-48 max-h-64 overflow-y-auto">
                  {countries.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => handleCountryChange(country)}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-all ${selectedCountry.code === country.code ? 'bg-black/10 dark:bg-white/10' : ''
                        }`}
                    >
                      <span className="text-gray-900 dark:text-white" style={{ fontSize: fontSize.sm }}>{country.name}</span>
                      <span className="text-gray-500 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>({country.currency})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="px-8 pb-8 flex justify-center">
            <div className="flex items-center bg-gray-200/40 dark:bg-black/40 rounded-2xl p-1.5 border border-black/5 dark:border-white/5">
              <button
                onClick={() => setIsYearly(false)}
                className={`px-8 py-2.5 rounded-xl bold transition-all ${!isYearly ? 'bg-white text-black shadow-lg' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                style={{ fontSize: fontSize.sm }}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`px-8 py-2.5 rounded-xl bold transition-all ${isYearly ? 'bg-white text-black shadow-lg' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                style={{ fontSize: fontSize.sm }}
              >
                Yearly
              </button>
            </div>
          </div>

          <div className={`p-8 pt-0 grid gap-6 ${isYearly ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
            {pricingTiers.map((tier, index) => (
              <TiltedCard
                key={index}
                containerHeight="100%"
                containerWidth="100%"
                scaleOnHover={1.08}
                rotateAmplitude={8}
              >
                <div className={`relative h-full flex flex-col bg-gray-200/40 dark:bg-gray-800/40 border ${tier.popular ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-black/10 dark:border-white/10'} rounded-[2.5rem] p-6 backdrop-blur-sm transition-all`}>

                  {isYearly && !isCurrentPlan(tier.name) && (
                    <div className="absolute top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full uppercase tracking-wider" style={{ fontSize: fontSize.xs }}>
                      2 Months Free
                    </div>
                  )}

                  <div className="mb-4">
                    <div className={`inline-block px-4 py-1 rounded-full uppercase bg-gradient-to-r ${tier.color || 'from-gray-600 to-gray-700'} text-white`} style={{ fontSize: fontSize.xs }}>
                      {tier.name}
                    </div>
                    {isYearly ? (
                      <div className="mt-2">
                        {selectedCountry.currency === 'INR' && tier.name !== 'Free' && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-600 dark:text-gray-500 line-through" style={{ fontSize: fontSize.xs }}>
                              {getCurrencySymbol(selectedCountry.currency)}{calculateOriginalPrice(tier.name, selectedCountry.currency, isYearly, exchangeRates).toFixed(2)}
                            </span>
                            <span className="text-green-600 dark:text-green-400 font-medium" style={{ fontSize: fontSize.xs }}>
                              {Math.round(((calculateOriginalPrice(tier.name, selectedCountry.currency, isYearly, exchangeRates) - tier.price) / calculateOriginalPrice(tier.name, selectedCountry.currency, isYearly, exchangeRates)) * 100)}% off
                            </span>
                          </div>
                        )}
                        <div className="text-gray-900 dark:text-white" style={{ fontSize: fontSize['2xl'] }}>{getCurrencySymbol(selectedCountry.currency)}{tier.price.toFixed(2)}</div>
                        <div className="text-blue-600 dark:text-blue-400" style={{ fontSize: fontSize.xs }}>
                          {getCurrencySymbol(selectedCountry.currency)}{calculatePrice(tier.name, selectedCountry.currency, false, exchangeRates).toFixed(2)}/month × 10 months + 2 months free
                        </div>
                        <div className="text-gray-600 dark:text-gray-500" style={{ fontSize: fontSize.xs }}>Total {getCurrencySymbol(selectedCountry.currency)}{tier.price.toFixed(2)} for 12 months</div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        {selectedCountry.currency === 'INR' && tier.name !== 'Free' && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-600 dark:text-gray-500 line-through" style={{ fontSize: fontSize.xs }}>
                              {getCurrencySymbol(selectedCountry.currency)}{calculateOriginalPrice(tier.name, selectedCountry.currency, false, exchangeRates).toFixed(2)}
                            </span>
                            <span className="text-green-600 dark:text-green-400 font-medium" style={{ fontSize: fontSize.xs }}>
                              {Math.round(((calculateOriginalPrice(tier.name, selectedCountry.currency, false, exchangeRates) - tier.price) / calculateOriginalPrice(tier.name, selectedCountry.currency, false, exchangeRates)) * 100)}% off
                            </span>
                          </div>
                        )}
                        <div className="text-gray-900 dark:text-white" style={{ fontSize: fontSize['2xl'] }}>{getCurrencySymbol(selectedCountry.currency)}{tier.price.toFixed(2)}</div>
                        <div className="text-gray-600 dark:text-gray-500" style={{ fontSize: fontSize.sm }}>/mo</div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 mb-6 flex-grow">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1.5 shrink-0" />
                      <div>
                        <span className="bg-yellow-400/30 text-yellow-600 dark:text-yellow-300 px-1 rounded" style={{ fontSize: fontSize.sm }}><b>{tier.totalCredits.toLocaleString()}</b> credits</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2" style={{ fontSize: fontSize.xs }}>(<b>{tier.creditsPerDay}</b> credits/day)</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1.5 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300" style={{ fontSize: fontSize.xs }}><b>{tier.maxQuestions}</b> questions per exam</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1.5 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300" style={{ fontSize: fontSize.xs }}><b>{tier.maxExamTypes}</b> exam types</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1.5 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300" style={{ fontSize: fontSize.xs }}><b>{tier.maxSubjects}</b> subjects per exam</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1.5 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300" style={{ fontSize: fontSize.xs }}><b>{tier.maxFriends}</b> max friends</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1.5 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300" style={{ fontSize: fontSize.xs }}><b>{tier.dailyChallenges}</b> challenges/day</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1.5 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300" style={{ fontSize: fontSize.xs }}><b>{tier.dailyImports}</b> exam imports/day</span>
                    </div>

                    {tier.name === 'Free' && (
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1.5 shrink-0" />
                        <span className="text-gray-600 dark:text-gray-300" style={{ fontSize: fontSize.xs }}>Use left over credits today</span>
                      </div>
                    )}

                    {tier.name !== 'Free' && (
                      <>
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1.5 shrink-0" />
                          <span className="text-gray-600 dark:text-gray-300" style={{ fontSize: fontSize.xs }}>Use left over credits</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1.5 shrink-0" />
                          <span className="text-gray-600 dark:text-gray-300" style={{ fontSize: fontSize.xs }}>Make private exams</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1.5 shrink-0" />
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-300" style={{ fontSize: fontSize.xs }}>Exclusive badge</span>
                            <PlanIcon planName={tier.name} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => handlePurchaseClick(tier)}
                    disabled={loading || isCurrentPlan(tier.name) || (!isPremium && tier.name === 'Free')}
                    className={`w-full py-2 sm:py-3 rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 font-medium
                      ${isCurrentPlan(tier.name) || (!isPremium && tier.name === 'Free')
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-not-allowed'
                        : tier.popular
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-900/20 hover:brightness-110'
                          : 'bg-white text-black hover:bg-gray-200'}
                      disabled:opacity-50`}
                    style={{ fontSize: fontSize.sm }}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isCurrentPlan(tier.name) || (!isPremium && tier.name === 'Free') ? 'IN USE' : getTierLevel(tier.name) < getTierLevel(currentPlan?.replace(/_monthly|_yearly|_month|_year$/, '') || '') ? 'DOWNGRADE' : 'UPGRADE'}
                  </button>
                </div>
              </TiltedCard>
            ))}
          </div>

          <div className="bg-black/[0.02] dark:bg-white/[0.02] p-8 border-t border-black/5 dark:border-white/5 flex flex-col items-center justify-between gap-4">
            <p className="text-gray-500 dark:text-gray-600 text-center w-full" style={{ fontSize: fontSize.xs }}>
              Payments processed via Razorpay. Subscriptions can be cancelled at any time from your dashboard settings.
            </p>
            <p className="text-gray-600 dark:text-gray-500 text-center w-full" style={{ fontSize: fontSize.xs }}>
              When you upgrade to any different plan, the plan will start instantly and does not wait for your current subscription to end.
            </p>
          </div>

        </div>
      </div>

      {showUpgradeWarning && (
        <div className="fixed inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-100 dark:bg-gray-900 border border-black/10 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3" style={{ fontSize: fontSize.xl }}>Upgrade Warning</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4" style={{ fontSize: fontSize.sm }}>
              Your current plan is already running and will end on {new Date(premiumEnds || '').toLocaleDateString()}.
              Upgrading to a new plan will take effect immediately.
            </p>
            <p className="text-yellow-600 dark:text-yellow-500 mb-6" style={{ fontSize: fontSize.xs }}>
              Are you sure you want to proceed with the upgrade?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUpgradeWarning(false);
                  setPendingTier(null);
                }}
                className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-medium hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowUpgradeWarning(false);
                  if (pendingTier) {
                    handlePurchase(pendingTier);
                    setPendingTier(null);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
