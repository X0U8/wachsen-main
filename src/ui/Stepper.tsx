import React, { useState, Children } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { fontSize } from '../lib/utils';

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  onNext,
  stepCircleContainerClassName = '',
  contentClassName = '',
  footerClassName = '',
  backButtonProps = {},
  nextButtonProps = {},
  backButtonText = 'Back',
  nextButtonText = 'Continue',
  disableStepIndicators = false,
  ...rest
}: {
  children: any;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  onNext?: (step: number) => boolean | Promise<boolean>;
  stepCircleContainerClassName?: string;
  stepContainerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  backButtonProps?: any;
  nextButtonProps?: any;
  backButtonText?: string;
  nextButtonText?: string;
  disableStepIndicators?: boolean;
  renderStepIndicator?: ((props: any) => React.ReactNode) | null;
  [key: string]: any;
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(0);
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  const updateStep = (newStep: number) => {
    setCurrentStep(newStep);
    if (newStep > totalSteps) {
      onFinalStepCompleted();
    } else {
      onStepChange(newStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      updateStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setDirection(1);
      updateStep(currentStep + 1);
    }
  };

  const handleComplete = () => {
    setDirection(1);
    updateStep(totalSteps + 1);
  };

  return (
    <div className="w-full max-w-lg mx-auto" {...rest}>
      <div className={`flex justify-between items-center mb-6 overflow-x-auto no-scrollbar py-2 gap-4 ${stepCircleContainerClassName}`}>
        {stepsArray.map((_, index) => {
          const stepNumber = index + 1;
          const isNotLastStep = index < totalSteps - 1;
          return (
            <React.Fragment key={stepNumber}>
              <StepIndicator
                step={stepNumber}
                disableStepIndicators={disableStepIndicators}
                currentStep={currentStep}
              />
              {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} />}
            </React.Fragment>
          );
        })}
      </div>

      <div className={`relative overflow-hidden ${contentClassName}`}>
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={{
              enter: (dir: number) => ({ x: dir >= 0 ? '100%' : '-100%', opacity: 0 }),
              center: { x: '0%', opacity: 1 },
              exit: (dir: number) => ({ x: dir >= 0 ? '-100%' : '100%', opacity: 0 })
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            {stepsArray[currentStep - 1]}
          </motion.div>
        </AnimatePresence>
      </div>

      {!isCompleted && (
        <div className={`mt-4 flex justify-between gap-3 max-w-[280px] mx-auto ${footerClassName}`}>
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-zinc-900/60 border border-gray-300/50 dark:border-white/20 hover:bg-gray-200 dark:hover:bg-zinc-800/80 rounded-xl disabled:opacity-30 text-gray-700 dark:text-white font-medium transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed"
            style={{ fontSize: fontSize.sm }}
            {...backButtonProps}
          >
            {backButtonText}
          </button>
          <button
            onClick={async () => {
              if (onNext) {
                const canAdvance = await onNext(currentStep);
                if (!canAdvance) return;
              }
              if (isLastStep) {
                handleComplete();
              } else {
                handleNext();
              }
            }}
            className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl text-white font-medium transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ fontSize: fontSize.sm }}
            {...nextButtonProps}
          >
            {isLastStep ? 'Complete' : nextButtonText}
          </button>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step, currentStep, disableStepIndicators }: { step: number; currentStep: number; disableStepIndicators: boolean }) {
  const status = currentStep === step ? 'active' : currentStep > step ? 'complete' : 'inactive';
  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-colors duration-300 ${
        status === 'active' 
          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md shadow-blue-500/10 dark:shadow-blue-500/20' 
          : status === 'complete' 
            ? 'bg-purple-100/60 dark:bg-purple-800/40 border border-purple-400 dark:border-purple-500 text-purple-700 dark:text-purple-200' 
            : 'bg-gray-100 dark:bg-zinc-900 border border-gray-300/50 dark:border-white/10 text-gray-400 dark:text-zinc-500'
      }`} style={{ fontSize: fontSize.sm }}>
        {status === 'complete' ? "\u2713" : step}
      </div>
    </div>
  );
}

function StepConnector({ isComplete }: { isComplete: boolean }) {
  return <div className={`flex-1 min-w-[24px] h-0.5 mx-1 flex-shrink-0 transition-colors duration-300 ${isComplete ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-200 dark:bg-zinc-900'}`} />;
}
