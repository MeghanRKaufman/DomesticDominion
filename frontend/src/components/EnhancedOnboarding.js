import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

const EnhancedOnboarding = ({ isOpen, onComplete, onClose }) => {
  const [step, setStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({
    playerName: '',
    householdType: 'Apartment',
    householdSize: 1,
    appliances: [],
    hasPets: false,
    petTypes: [],
    bathrooms: 1,
    hasYard: false,
    environmentalConditions: []
  });

  const getTotalSteps = () => {
    return onboardingData.hasPets ? 7 : 6;
  };

  const handleInputChange = (field, value) => {
    setOnboardingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayToggle = (field, item) => {
    setOnboardingData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(x => x !== item)
        : [...prev[field], item]
    }));
  };

  const nextStep = () => {
    const total = getTotalSteps();
    if (step < total) {
      if (step === 4 && !onboardingData.hasPets) {
        setStep(6);
      } else {
        setStep(step + 1);
      }
    } else {
      onComplete(onboardingData);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      if (step === 6 && !onboardingData.hasPets) {
        setStep(4);
      } else {
        setStep(step - 1);
      }
    }
  };

  const renderProgressBar = () => {
    const total = getTotalSteps();
    const progress = (step / total) * 100;
    
    return (
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Step {step} of {total}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">👋 Welcome to Domestic Dominion!</h2>
        <p className="text-gray-600">Let's set up your household adventure</p>
      </div>
      <div>
        <Label htmlFor="playerName" className="text-lg">What's your name?</Label>
        <Input
          id="playerName"
          value={onboardingData.playerName}
          onChange={(e) => handleInputChange('playerName', e.target.value)}
          placeholder="Enter your name"
          className="text-lg mt-2"
        />
      </div>
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-700">💡 This quick setup will help us customize your household experience!</p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🏠 Household Type</h2>
        <p className="text-gray-600">What type of home do you live in?</p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {['Apartment', 'House', 'Shared Housing / Dorm'].map(type => (
          <Button
            key={type}
            variant={onboardingData.householdType === type ? 'default' : 'outline'}
            onClick={() => handleInputChange('householdType', type)}
            className="h-20 text-lg justify-start px-6"
          >
            <span className="text-3xl mr-4">
              {type === 'Apartment' && '🏢'}
              {type === 'House' && '🏡'}
              {type === 'Shared Housing / Dorm' && '🏘️'}
            </span>
            {type}
          </Button>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">👥 Household Size</h2>
        <p className="text-gray-600">How many people live in your home (including you)?</p>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
          <Button
            key={num}
            variant={onboardingData.householdSize === num ? 'default' : 'outline'}
            onClick={() => handleInputChange('householdSize', num)}
            className="h-16 text-xl font-bold"
          >
            {num}
          </Button>
        ))}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🔧 Key Appliances</h2>
        <p className="text-gray-600">Which appliances do you have?</p>
      </div>
      <div className="space-y-3">
        {['Washer', 'Dryer', 'Dishwasher'].map(appliance => (
          <Button
            key={appliance}
            variant={onboardingData.appliances.includes(appliance) ? 'default' : 'outline'}
            onClick={() => handleArrayToggle('appliances', appliance)}
            className="w-full h-16 text-lg justify-start px-6"
          >
            <span className="text-2xl mr-4">
              {appliance === 'Washer' && '🧺'}
              {appliance === 'Dryer' && '🌀'}
              {appliance === 'Dishwasher' && '🍽️'}
            </span>
            {appliance}
            {onboardingData.appliances.includes(appliance) && <span className="ml-auto text-2xl">✓</span>}
          </Button>
        ))}
      </div>
      <p className="text-sm text-gray-500 text-center">Select all that apply</p>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🐾 Pets</h2>
        <p className="text-gray-600">Do you have pets?</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Button
          variant={onboardingData.hasPets === true ? 'default' : 'outline'}
          onClick={() => handleInputChange('hasPets', true)}
          className="h-32 flex flex-col items-center justify-center"
        >
          <div className="text-5xl mb-2">🐶</div>
          <div className="text-lg font-bold">Yes</div>
        </Button>
        <Button
          variant={onboardingData.hasPets === false ? 'default' : 'outline'}
          onClick={() => {
            handleInputChange('hasPets', false);
            handleInputChange('petTypes', []);
          }}
          className="h-32 flex flex-col items-center justify-center"
        >
          <div className="text-5xl mb-2">🚫</div>
          <div className="text-lg font-bold">No</div>
        </Button>
      </div>
    </div>
  );

  const renderStep5a = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🐕 Pet Types</h2>
        <p className="text-gray-600">Which types of pets do you have?</p>
      </div>
      <div className="space-y-3">
        {['Dogs', 'Cats', 'Other small pets'].map(petType => (
          <Button
            key={petType}
            variant={onboardingData.petTypes.includes(petType) ? 'default' : 'outline'}
            onClick={() => handleArrayToggle('petTypes', petType)}
            className="w-full h-16 text-lg justify-start px-6"
          >
            <span className="text-2xl mr-4">
              {petType === 'Dogs' && '🐕'}
              {petType === 'Cats' && '🐈'}
              {petType === 'Other small pets' && '🐹'}
            </span>
            {petType}
            {onboardingData.petTypes.includes(petType) && <span className="ml-auto text-2xl">✓</span>}
          </Button>
        ))}
      </div>
      <p className="text-sm text-gray-500 text-center">Select all that apply</p>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🚿 Bathrooms</h2>
        <p className="text-gray-600">How many bathrooms are in your home?</p>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map(num => (
          <Button
            key={num}
            variant={onboardingData.bathrooms === num ? 'default' : 'outline'}
            onClick={() => handleInputChange('bathrooms', num)}
            className="h-16 text-xl font-bold"
          >
            {num}
          </Button>
        ))}
      </div>
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🌳 Outdoor & Environment</h2>
        <p className="text-gray-600">Just a couple more optional questions</p>
      </div>
      <div className="space-y-4">
        <div>
          <Label className="text-lg font-semibold mb-3 block">Do you have a yard or garden?</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={onboardingData.hasYard === true ? 'default' : 'outline'}
              onClick={() => handleInputChange('hasYard', true)}
              className="h-16"
            >
              Yes
            </Button>
            <Button
              variant={onboardingData.hasYard === false ? 'default' : 'outline'}
              onClick={() => handleInputChange('hasYard', false)}
              className="h-16"
            >
              No
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-lg font-semibold mb-3 block">Environmental Conditions</Label>
          <div className="space-y-2">
            {['High dust', 'Snowfall'].map(condition => (
              <Button
                key={condition}
                variant={onboardingData.environmentalConditions.includes(condition) ? 'default' : 'outline'}
                onClick={() => handleArrayToggle('environmentalConditions', condition)}
                className="w-full h-12 justify-start px-4"
              >
                {condition}
                {onboardingData.environmentalConditions.includes(condition) && <span className="ml-auto">✓</span>}
              </Button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Optional - helps customize tasks</p>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">🏠 Household Setup</DialogTitle>
        </DialogHeader>
        <div className="p-6">
          {renderProgressBar()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && onboardingData.hasPets && renderStep5a()}
          {step === 6 && !onboardingData.hasPets && renderStep6()}
          {step === 7 && onboardingData.hasPets && renderStep6()}
          {step === 7 && !onboardingData.hasPets && renderStep7()}
          {step === 8 && renderStep7()}
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={step === 1}
              className="px-6"
            >
              ← Previous
            </Button>
            <Button
              onClick={nextStep}
              disabled={step === 1 && !onboardingData.playerName?.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6"
            >
              {step === getTotalSteps() ? '🚀 Start Playing!' : 'Next →'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedOnboarding;
