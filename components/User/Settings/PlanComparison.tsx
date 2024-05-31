import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useChangeSubscriptionPlan } from '@/hooks/useChangeSubscriptionPlan';

import {
  OrderedSubscriptionPlans,
  STRIPE_PAID_PLAN_LINKS,
} from '@/utils/app/const';
import { trackEvent } from '@/utils/app/eventTracking';
import { FeatureItem, PlanDetail } from '@/utils/app/ui';

import { User } from '@/types/user';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import dayjs from 'dayjs';

const PlanComparison = ({ user }: { user: User | null }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] justify-center gap-3 mb-3">
      {/* Free Plan */}
      <div className="flex flex-col w-full col-start-1 row-span-1 border rounded-lg p-4 text-neutral-3000 border-neutral-400">
        <FreePlanContent user={user} />
      </div>

      {/* Pro Plan */}
      <div className="flex flex-col w-full col-start-1 row-span-1 border rounded-lg p-4">
        <ProPlanContent user={user} />
      </div>

      {/* Ultra Plan */}
      <div className="flex flex-col w-full col-start-1 row-start-auto md:row-start-1 md:col-start-2 row-span-2 border rounded-lg p-4">
        <UltraPlanContent user={user} />
      </div>
    </div>
  );
};

export default PlanComparison;

const PlanExpirationDate: React.FC<{ expirationDate: string }> = ({
  expirationDate,
}) => {
  console.log({
    expirationDate,
  });
  const { t } = useTranslation('model');
  return (
    <div className="flex mt-4 grow items-end justify-center">
      <div className="text-left text-neutral-500 p-2 text-xs">
        {`${t('Expires on')}: ${dayjs(expirationDate).format('ll')}`}
      </div>
    </div>
  );
};

const FreePlanContent = ({ user }: { user: User | null }) => {
  const { t } = useTranslation('model');
  return (
    <>
      <div className="flex flex-row items-center justify-between gap-2">
        <span className="text-2xl py-0.5 font-bold">Free</span>
        {(user?.plan === 'free' || !user) && <CurrentPlanTag />}
      </div>
      <div className="text-xs leading-5">
        {PlanDetail.free.features.map((feature, index) => (
          <FeatureItem key={index} featureName={t(feature)} />
        ))}
      </div>
    </>
  );
};
const ProPlanContent = ({ user }: { user: User | null }) => {
  const { t, i18n } = useTranslation('model');
  const showUpgradeToPro = useMemo(() => {
    if (!user) return true;
    const userPlanIndex = OrderedSubscriptionPlans.indexOf(user.plan);
    const proPlanIndex = OrderedSubscriptionPlans.indexOf('pro');
    return userPlanIndex < proPlanIndex;
  }, [user]);
  const { mutate: changeSubscriptionPlan } = useChangeSubscriptionPlan();

  const upgradeLinkOnClick = () => {
    const paymentLink =
      i18n.language === 'zh-Hant' || i18n.language === 'zh'
        ? STRIPE_PAID_PLAN_LINKS['pro-monthly'].twd.link
        : STRIPE_PAID_PLAN_LINKS['pro-monthly'].usd.link;

    const userEmail = user?.email;
    const userId = user?.id;

    trackEvent('Upgrade button clicked');

    if (!user) {
      toast.error(t('Please sign-up before upgrading to paid plan'));
    } else {
      window.open(
        `${paymentLink}?prefilled_email=${userEmail}&client_reference_id=${userId}`,
        '_blank',
      );
    }
  };

  return (
    <>
      <div className="flex flex-row items-center justify-between gap-2">
        <span
          className="text-clip-transparent bg-gradient-pro py-0.5 mr-0 animate-background-gradient-slide bg-500% text-2xl font-bold rounded bg-gray-700"
          style={{
            color: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextStrokeWidth: '1px',
            WebkitTextStrokeColor: 'transparent',
          }}
        >
          Pro
        </span>
        {user?.plan === 'pro' && <CurrentPlanTag />}
      </div>
      <ProPlanPrice />
      <div className="text-xs leading-5">
        <FeatureItem featureName={t('Everything in free plan')} />
        <FeatureItem featureName={t('Priority response time')} />
        {PlanDetail.pro.features.map((feature, index) => (
          <FeatureItem key={index} featureName={t(feature)} />
        ))}
      </div>
      {/* Upgrade button */}
      {showUpgradeToPro && (
        <div className="flex items-center flex-col">
          <a
            target="_blank"
            rel="noreferrer"
            onClick={upgradeLinkOnClick}
            className="w-full px-4 py-2 border rounded-lg bg-white shadow border-none text-white font-semibold focus:outline-none mt-4 text-center text-sm cursor-pointer bg-gradient-to-r from-[#fd68a6] to-[#6c62f7]"
          >
            {t('Upgrade')}
          </a>
          <p className="text-xs text-neutral-400 mt-2">
            {t('No Strings Attached - Cancel Anytime!')}
          </p>
        </div>
      )}
      {user?.plan === 'ultra' && user.proPlanExpirationDate && (
        <div className="flex items-center flex-col">
          <a
            target="_blank"
            rel="noreferrer"
            onClick={() => changeSubscriptionPlan()}
            className="w-full px-4 py-2 border rounded-lg bg-white shadow border-none text-white font-semibold focus:outline-none mt-4 text-center text-sm cursor-pointer bg-gradient-to-r from-[#fd68a6] to-[#6c62f7]"
          >
            {t('Change to Pro Plan')}
          </a>
        </div>
      )}

      {user?.plan === 'pro' && user.proPlanExpirationDate && (
        <PlanExpirationDate expirationDate={user.proPlanExpirationDate} />
      )}
    </>
  );
};

const UltraPlanContent = ({ user }: { user: User | null }) => {
  const { t, i18n } = useTranslation('model');
  const [priceType, setPriceType] = useState<'monthly' | 'yearly'>('monthly');
  const showUpgradeToUltra = useMemo(() => {
    if (!user) return true;
    const userPlanIndex = OrderedSubscriptionPlans.indexOf(user.plan);
    const ultraPlanIndex = OrderedSubscriptionPlans.indexOf('ultra');
    return userPlanIndex < ultraPlanIndex;
  }, [user]);

  const { mutate: changeSubscriptionPlan } = useChangeSubscriptionPlan();

  const upgradeLinkOnClick = () => {
    let paymentLink = STRIPE_PAID_PLAN_LINKS['ultra-monthly'].usd.link;
    if (priceType === 'monthly') {
      if (i18n.language === 'zh-Hant' || i18n.language === 'zh') {
        paymentLink = STRIPE_PAID_PLAN_LINKS['ultra-monthly'].twd.link;
      } else {
        paymentLink = STRIPE_PAID_PLAN_LINKS['ultra-monthly'].usd.link;
      }
    } else {
      if (i18n.language === 'zh-Hant' || i18n.language === 'zh') {
        paymentLink = STRIPE_PAID_PLAN_LINKS['ultra-yearly'].twd.link;
      } else {
        paymentLink = STRIPE_PAID_PLAN_LINKS['ultra-yearly'].usd.link;
      }
    }

    const userEmail = user?.email;
    const userId = user?.id;

    trackEvent('Upgrade button clicked');

    if (!user) {
      toast.error(t('Please sign-up before upgrading to paid plan'));
    } else {
      window.open(
        `${paymentLink}?prefilled_email=${userEmail}&client_reference_id=${userId}`,
        '_blank',
      );
    }
  };

  return (
    <>
      <div className="flex flex-row items-center justify-between gap-2">
        <span
          className="text-clip-transparent bg-gradient-ultra py-0.5 mr-0 animate-background-gradient-slide bg-500% text-2xl font-bold rounded bg-gray-700"
          style={{
            color: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextStrokeWidth: '1px',
            WebkitTextStrokeColor: 'transparent',
          }}
        >
          Ultra
        </span>
        {user?.plan === 'ultra' && <CurrentPlanTag />}
      </div>
      {user?.plan !== 'ultra' && <UltraPlanPrice setPriceType={setPriceType} />}

      <div className="text-xs leading-5">
        <FeatureItem featureName={t('Everything in free plan')} />
        <FeatureItem featureName={t('Priority response time')} />
        {PlanDetail.ultra.features.map((feature, index) => (
          <FeatureItem key={index} featureName={t(feature)} />
        ))}
      </div>
      {/* Upgrade button */}
      {showUpgradeToUltra && (
        <div className="flex items-center flex-col">
          <a
            target="_blank"
            rel="noreferrer"
            onClick={upgradeLinkOnClick}
            className="w-full px-4 py-2 border rounded-lg bg-white shadow border-none text-white font-semibold focus:outline-none mt-4 text-center text-sm cursor-pointer bg-gradient-to-r from-[#fd68a6] to-[#6c62f7]"
          >
            {t('Upgrade to Ultra')}
          </a>
          <p className="text-xs text-neutral-400 mt-2">
            {t('No Strings Attached - Cancel Anytime!')}
          </p>
        </div>
      )}

      {user?.plan === 'pro' && user.proPlanExpirationDate && (
        <div className="flex items-center flex-col">
          <a
            target="_blank"
            rel="noreferrer"
            onClick={() => changeSubscriptionPlan()}
            className="w-full px-4 py-2 border rounded-lg bg-white shadow border-none text-white font-semibold focus:outline-none mt-4 text-center text-sm cursor-pointer bg-gradient-to-r from-[#fd68a6] to-[#6c62f7]"
          >
            {t('Change to Ultra Plan')}
          </a>
        </div>
      )}

      {user?.plan === 'ultra' && user.proPlanExpirationDate && (
        <PlanExpirationDate expirationDate={user.proPlanExpirationDate} />
      )}
    </>
  );
};

const CurrentPlanTag = () => {
  return (
    <span className="h-max bg-neutral-600 text-neutral-400 text-[10px]  font-medium mr-2 px-2 py-[.5px] rounded w-max">
      CURRENT PLAN
    </span>
  );
};

const ProPlanPrice = () => {
  const { i18n } = useTranslation('model');

  switch (i18n.language) {
    case 'zh-Hant':
    case 'zh':
      return <span className="text-sm mb-2">{'TWD$249.99 / month'}</span>;
    default:
      return <span className="text-sm mb-2">{'USD$9.99 / month'}</span>;
  }
};

const UltraPlanPrice = ({
  setPriceType,
}: {
  setPriceType: (type: 'monthly' | 'yearly') => void;
}) => {
  const { t, i18n } = useTranslation('model');

  return (
    <Tabs defaultValue="monthly" className="mt-2 mb-4 w-full">
      <TabsList className="w-full">
        <TabsTrigger
          value="monthly"
          className="w-full"
          onClick={() => {
            setPriceType('monthly');
          }}
        >
          {t('MONTHLY')}
        </TabsTrigger>
        <TabsTrigger
          value="yearly"
          className="w-full"
          onClick={() => {
            setPriceType('yearly');
          }}
        >
          {t('YEARLY')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="monthly">
        {i18n.language === 'zh-Hant' || i18n.language === 'zh' ? (
          <span className="text-sm mb-2">{'TWD$880 / month'}</span>
        ) : (
          <span className="text-sm mb-2">{'USD$29.99 / month'}</span>
        )}
      </TabsContent>
      <TabsContent value="yearly">
        {i18n.language === 'zh-Hant' || i18n.language === 'zh' ? (
          <span className="text-sm mb-2">{'TWD$8800 / year'}</span>
        ) : (
          <span className="text-sm mb-2">{'USD$279.99 / year'}</span>
        )}
      </TabsContent>
    </Tabs>
  );
};
