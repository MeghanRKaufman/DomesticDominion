import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

const EnhancedOnboarding = ({ isOpen, onComplete, onClose }) => {
  const [step, setStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({
    // Core Data
    playerName: '',
    
    // Step 1: Household Type
    householdType: 'Apartment',
    
    // Step 2: Household Size
    householdSize: 1,
    
    // Step 3: Key Appliances
    appliances: [],
    
    // Step 4: Pets
    hasPets: false,
    petTypes: [],
    
    // Step 5: Bathrooms
    bathrooms: 1,
    
    // Optional: Outdoor Space
    hasYard: false,
    
    // Optional: Environmental Conditions
    environmentalConditions: []
  });

  const totalSteps = () => {
    let count = 6; // Name + 5 core steps
    if (onboardingData.hasPets) count++; // Add pet types step
    return count;
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
    if (step < totalSteps()) {
      // Skip pet types step if no pets
      if (step === 4 && !onboardingData.hasPets) {
        setStep(step + 2); // Skip to bathrooms
      } else {
        setStep(step + 1);
      }
    } else {
      onComplete(onboardingData);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      // Skip pet types step when going back if no pets
      if (step === 6 && !onboardingData.hasPets) {
        setStep(step - 2); // Go back to pets question
      } else {
        setStep(step - 1);
      }
    }
  };

  // Step 1: Player Name
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">👋 Welcome to Domestic Dominion!</h2>
        <p className="text-gray-600">Let's set up your household adventure</p>
      </div>
      
      <div>
        <Label htmlFor="playerName">What's your name?</Label>
        <Input
          id="playerName"
          value={onboardingData.playerName}
          onChange={(e) => handleInputChange('playerName', e.target.value)}
          placeholder="Enter your name"
          className="text-lg"
        />
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-700">
          💡 This quick setup will help us customize your experience!
        </p>
      </div>
    </div>
  );

  // Step 2: Household Type
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
            className="h-20 text-lg"
          >
            {type === 'Apartment' && '🏢 '}
            {type === 'House' && '🏡 '}
            {type === 'Shared Housing / Dorm' && '🏘️ '}
            {type}
          </Button>
        ))}
      </div>
    </div>
  );

  // Step 3: Household Size
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

  // Step 4: Key Appliances
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
            className="w-full h-16 text-lg"
          >
            {appliance === 'Washer' && '🧺 '}
            {appliance === 'Dryer' && '🌀 '}
            {appliance === 'Dishwasher' && '🍽️ '}
            {appliance}
            {onboardingData.appliances.includes(appliance) && ' ✓'}
          </Button>
        ))}
      </div>
      
      <p className="text-sm text-gray-500 text-center">Select all that apply</p>
    </div>
  );

  // Step 5: Pets
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
          className="h-24 flex flex-col items-center justify-center text-lg"
        >
          <div className="text-4xl mb-2">🐶</div>
          <div>Yes</div>
        </Button>
        <Button
          variant={onboardingData.hasPets === false ? 'default' : 'outline'}
          onClick={() => handleInputChange('hasPets', false)}
          className="h-24 flex flex-col items-center justify-center text-lg"
        >
          <div className="text-4xl mb-2">🚫</div>
          <div>No</div>
        </Button>
      </div>
    </div>
  );

  // Step 5a: Pet Types (conditional)
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
          <DialogTitle className="text-center">
            🚀 Adventure Setup - Step {step} of {totalSteps}
          </DialogTitle>
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
          {step === 7 && renderStep6()}
          
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={step === 1}
            >
              ← Previous
            </Button>
            
            <Button
              onClick={nextStep}
              disabled={step === 1 && !onboardingData.playerName?.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white"
            >
              {step === totalSteps() ? '🚀 Start Playing!' : 'Next →'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedOnboarding;