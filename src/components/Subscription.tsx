import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '../lib/UserContext';
import BuyCreditsModal from '../ui/BuyCreditsModal';

export default function Subscription() {
  const navigate = useNavigate();
  const { userProfile, refreshCredits, refreshProfile } = useUserProfile();

  const handleClose = () => {
    // Navigate back if possible, otherwise go to exam page
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/exam');
    }
  };

  return (
    <BuyCreditsModal
      onClose={handleClose}
      userId={userProfile?.$id}
      onPaymentSuccess={async () => {
        if (refreshCredits) {
          await refreshCredits();
        }
      }}
      currentPlan={userProfile?.PremiumType}
      isPremium={userProfile?.isPremium}
      premiumEnds={userProfile?.premiumEnds}
      refreshProfile={refreshProfile}
    />
  );
}
