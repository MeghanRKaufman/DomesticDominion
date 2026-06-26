import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';

const ProgressiveOnboarding = ({ isOpen, onComplete, onClose }) => {
  const [step, setStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({
    // Step 1: Household Basics
    householdName: '',
    adminName: '',
    householdSize: 2,
    hasPrivateBedrooms: false,
    // NEW: Role + governance (Phase 1 refactor)
    creatorRole: 'resident_manager', // resident_member | resident_manager | external_supervisor
    creatorLivesInHousehold: true,
    supervisorPermissions: 'full_overseer', // read_only | can_assign | full_overseer
    governance: 'round_table', // round_table | stewardship_council | external_oversight

    // Step 2: Home Layout
    rooms: {
      kitchen: true,
      livingRoom: true,
      bathrooms: 1,
      bedrooms: 1,
      basement: false,
      attic: false,
      office: false,
      garage: false,
      // NEW: Outdoor spaces
      patio: false,
      deck: false,
      balcony: false,
      yard: false,
      garden: false,
    },
    floors: 'single', // single, multi-level

    // Step 3: Utilities & Constraints
    laundryType: 'in_unit', // in_unit, shared, laundromat
    dryingMethod: [], // dryer, line_dry
    laundromat_runs_per_week: 0,
    trashDays: [],
    hasCleaningSupplies: true,

    // Step 4: Pets & Vehicles
    pets: [], // {type: 'dog', count: 2}
    vehicles: [], // {type: 'car', shared: true}

    // Step 5: Time Reality (for admin only during onboarding)
    availability: {
      mondayToFriday: { start: '18:00', end: '22:00' },
      weekend: { start: '08:00', end: '20:00' },
      workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      lowEnergyDays: [],
    },

    // Step 6: Personal Limits
    choreAversions: [], // 'grossness', 'physical', 'outdoor', 'pets'
    preferredTasks: [],
    // NOTE: maxDailyChoreLoad removed in Phase 1 — Dynamic Capacity Engine (Phase 2) will derive capacity from schedule, not user-declared limits.

    // Step 7: Talent Spec
    initialTalentSpec: '', // self_care, teamwork, housework
  });

  const handleInputChange = (field, value) => {
    setOnboardingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedChange = (parent, field, value) => {
    setOnboardingData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
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

  const addPet = (type) => {
    setOnboardingData(prev => {
      const existing = prev.pets.find(p => p.type === type);
      if (existing) {
        return {
          ...prev,
          pets: prev.pets.map(p => 
            p.type === type ? { ...p, count: p.count + 1 } : p
          )
        };
      }
      return {
        ...prev,
        pets: [...prev.pets, { type, count: 1 }]
      };
    });
  };

  const removePet = (type) => {
    setOnboardingData(prev => ({
      ...prev,
      pets: prev.pets.map(p => 
        p.type === type ? { ...p, count: Math.max(0, p.count - 1) } : p
      ).filter(p => p.count > 0)
    }));
  };

  const addVehicle = (type, shared) => {
    setOnboardingData(prev => ({
      ...prev,
      vehicles: [...prev.vehicles, { type, shared, id: Date.now() }]
    }));
  };

  const removeVehicle = (id) => {
    setOnboardingData(prev => ({
      ...prev,
      vehicles: prev.vehicles.filter(v => v.id !== id)
    }));
  };

  const nextStep = () => {
    // Skip pets/vehicles step if neither exist
    if (step === 3 && onboardingData.pets.length === 0 && onboardingData.vehicles.length === 0) {
      setStep(5);
    } else if (step < 6) {
      setStep(step + 1);
    } else {
      // Step 6 is now the final step
      onComplete(onboardingData);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      // Skip back over pets/vehicles if it was skipped
      if (step === 5 && onboardingData.pets.length === 0 && onboardingData.vehicles.length === 0) {
        setStep(3);
      } else {
        setStep(step - 1);
      }
    }
  };

  const renderProgressBar = () => {
    const progress = (step / 6) * 100;
    
    return (
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Step {step} of 6</span>
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

  // STEP 1: Household Basics
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🏰 Welcome to Domestic Dominion!</h2>
        <p className="text-gray-600 mb-4">Let's set up your household kingdom</p>
        <div className="text-left bg-purple-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-purple-800">
            Transform your household chores into epic quests! We'll customize your experience based on your home setup, 
            so every task feels like an adventure. Just a few questions and you'll be ready to rule your domain.
          </p>
        </div>
      </div>
      
      <div>
        <Label htmlFor="householdName" className="text-lg font-semibold">Household Name</Label>
        <Input
          id="householdName"
          value={onboardingData.householdName}
          onChange={(e) => handleInputChange('householdName', e.target.value)}
          placeholder="e.g., The Smith Castle"
          className="text-lg mt-2"
        />
      </div>

      <div>
        <Label htmlFor="adminName" className="text-lg font-semibold">Your Name (Admin)</Label>
        <Input
          id="adminName"
          value={onboardingData.adminName}
          onChange={(e) => handleInputChange('adminName', e.target.value)}
          placeholder="Enter your name"
          className="text-lg mt-2"
        />
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Your Role in this Household</Label>
        <p className="text-sm text-gray-600 mb-3">Pick the relationship that fits — this is not a hierarchy.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { key: 'resident_member', label: 'Resident Member', icon: '🏠', sub: 'I live here and pull my weight' },
            { key: 'resident_manager', label: 'Resident Manager', icon: '🗝️', sub: 'I live here AND coordinate the household' },
            { key: 'external_supervisor', label: 'External Supervisor', icon: '🛡️', sub: "I oversee but don't live here" },
          ].map((r) => (
            <Button
              key={r.key}
              variant={onboardingData.creatorRole === r.key ? 'default' : 'outline'}
              onClick={() => handleInputChange('creatorRole', r.key)}
              className="h-auto py-3 px-3 flex flex-col items-start text-left"
              data-testid={`onboarding-role-${r.key}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{r.icon}</span>
                <span className="font-semibold">{r.label}</span>
              </div>
              <span className="text-xs opacity-80 whitespace-normal">{r.sub}</span>
            </Button>
          ))}
        </div>
      </div>

      {onboardingData.creatorRole === 'external_supervisor' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <Label className="text-base font-semibold block">Supervisor Permissions</Label>
          <p className="text-xs text-gray-600">What can you do in this household?</p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { key: 'read_only', label: 'Read-only — see progress, no assigning' },
              { key: 'can_assign', label: 'Can assign chores + see progress' },
              { key: 'full_overseer', label: 'Full overseer — approve swaps, manage members' },
            ].map((p) => (
              <Button
                key={p.key}
                variant={onboardingData.supervisorPermissions === p.key ? 'default' : 'outline'}
                onClick={() => handleInputChange('supervisorPermissions', p.key)}
                className="justify-start text-left h-auto py-2"
                data-testid={`onboarding-supervisor-${p.key}`}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label className="text-lg font-semibold mb-3 block">Household Governance</Label>
        <p className="text-sm text-gray-600 mb-3">How big household decisions get made. (Round Table is recommended.)</p>
        <div className="grid grid-cols-1 gap-2">
          {[
            { key: 'round_table', label: '⚖️ Round Table', sub: 'The app arbitrates day-to-day. Major decisions need the residents’ approval. Default.' },
            { key: 'stewardship_council', label: '🛡️ Stewardship Council', sub: 'Designated stewards make decisions on behalf of the household.' },
            { key: 'external_oversight', label: '🦉 External Oversight', sub: 'A non-resident supervisor signs off on major decisions.' },
          ].map((g) => (
            <Button
              key={g.key}
              variant={onboardingData.governance === g.key ? 'default' : 'outline'}
              onClick={() => handleInputChange('governance', g.key)}
              className="h-auto py-3 px-4 justify-start text-left whitespace-normal"
              data-testid={`onboarding-governance-${g.key}`}
            >
              <div className="flex flex-col items-start">
                <span className="font-semibold">{g.label}</span>
                <span className="text-xs opacity-80">{g.sub}</span>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {onboardingData.creatorRole !== 'external_supervisor' && (
      <div>
        <Label className="text-lg font-semibold mb-3 block">Household Size</Label>
        <p className="text-sm text-gray-600 mb-3">How many people live here (including you)?</p>
        <div className="grid grid-cols-6 gap-2">
          {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
            <Button
              key={num}
              variant={onboardingData.householdSize === num ? 'default' : 'outline'}
              onClick={() => handleInputChange('householdSize', num)}
              className="h-12 font-bold"
            >
              {num}
            </Button>
          ))}
        </div>
      </div>
      )}

      {onboardingData.creatorRole !== 'external_supervisor' && (
      <div>
        <Label className="text-lg font-semibold mb-3 block">Bedroom Setup</Label>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={!onboardingData.hasPrivateBedrooms ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasPrivateBedrooms', false)}
            className="h-20 flex flex-col"
          >
            <span className="text-3xl mb-1">🛏️</span>
            <span>Shared Bedrooms</span>
          </Button>
          <Button
            variant={onboardingData.hasPrivateBedrooms ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasPrivateBedrooms', true)}
            className="h-20 flex flex-col"
          >
            <span className="text-3xl mb-1">🚪</span>
            <span>Private Bedrooms</span>
          </Button>
        </div>
      </div>
      )}
    </div>
  );

  // STEP 2: Home Layout
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🏠 Home Layout</h2>
        <p className="text-gray-600">Which rooms and spaces do you have?</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-lg font-semibold mb-2 block">Bathrooms</Label>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(num => (
              <Button
                key={num}
                variant={onboardingData.rooms.bathrooms === num ? 'default' : 'outline'}
                onClick={() => handleNestedChange('rooms', 'bathrooms', num)}
                className="h-12 text-lg font-bold"
              >
                {num}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-lg font-semibold mb-2 block">Bedrooms</Label>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(num => (
              <Button
                key={num}
                variant={onboardingData.rooms.bedrooms === num ? 'default' : 'outline'}
                onClick={() => handleNestedChange('rooms', 'bedrooms', num)}
                className="h-12 text-lg font-bold"
              >
                {num}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-lg font-semibold mb-2 block">Additional Spaces</Label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'basement', label: 'Basement', icon: '🏚️' },
              { key: 'attic', label: 'Attic', icon: '🪜' },
              { key: 'office', label: 'Office', icon: '💼' },
              { key: 'garage', label: 'Garage', icon: '🚗' },
            ].map(space => (
              <Button
                key={space.key}
                variant={onboardingData.rooms[space.key] ? 'default' : 'outline'}
                onClick={() => handleNestedChange('rooms', space.key, !onboardingData.rooms[space.key])}
                className="h-16 justify-start px-4"
              >
                <span className="text-2xl mr-3">{space.icon}</span>
                <span>{space.label}</span>
                {onboardingData.rooms[space.key] && <span className="ml-auto text-2xl">✓</span>}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-lg font-semibold mb-2 block">Outdoor Areas</Label>
          <p className="text-sm text-gray-600 mb-2">So we can assign chores to the right places.</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'patio', label: 'Patio', icon: '🪴' },
              { key: 'deck', label: 'Deck', icon: '🪑' },
              { key: 'balcony', label: 'Balcony', icon: '🌇' },
              { key: 'yard', label: 'Yard', icon: '🌳' },
              { key: 'garden', label: 'Garden', icon: '🌷' },
            ].map(space => (
              <Button
                key={space.key}
                variant={onboardingData.rooms[space.key] ? 'default' : 'outline'}
                onClick={() => handleNestedChange('rooms', space.key, !onboardingData.rooms[space.key])}
                className="h-16 justify-start px-4"
                data-testid={`onboarding-outdoor-${space.key}`}
              >
                <span className="text-2xl mr-3">{space.icon}</span>
                <span>{space.label}</span>
                {onboardingData.rooms[space.key] && <span className="ml-auto text-2xl">✓</span>}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-lg font-semibold mb-2 block">Floors</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={onboardingData.floors === 'single' ? 'default' : 'outline'}
              onClick={() => handleInputChange('floors', 'single')}
              className="h-16"
            >
              Single Level
            </Button>
            <Button
              variant={onboardingData.floors === 'multi-level' ? 'default' : 'outline'}
              onClick={() => handleInputChange('floors', 'multi-level')}
              className="h-16"
            >
              Multi-Level
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // STEP 3: Utilities & Constraints
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🔧 Utilities & Constraints</h2>
        <p className="text-gray-600">How does your household operate?</p>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Laundry Setup</Label>
        <div className="space-y-2">
          {[
            { key: 'in_unit', label: 'In-Unit (Washer/Dryer in home)', icon: '🧺' },
            { key: 'shared', label: 'Shared (Building laundry room)', icon: '🏢' },
            { key: 'laundromat', label: 'Laundromat', icon: '🏪' },
          ].map(type => (
            <Button
              key={type.key}
              variant={onboardingData.laundryType === type.key ? 'default' : 'outline'}
              onClick={() => handleInputChange('laundryType', type.key)}
              className="w-full h-16 justify-start px-4"
            >
              <span className="text-2xl mr-3">{type.icon}</span>
              <span>{type.label}</span>
              {onboardingData.laundryType === type.key && <span className="ml-auto text-2xl">✓</span>}
            </Button>
          ))}
        </div>
      </div>

      {onboardingData.laundryType === 'laundromat' && (
        <div>
          <Label className="text-lg font-semibold mb-2 block">Laundromat Runs Per Week</Label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(num => (
              <Button
                key={num}
                variant={onboardingData.laundromat_runs_per_week === num ? 'default' : 'outline'}
                onClick={() => handleInputChange('laundromat_runs_per_week', num)}
                className="h-12 font-bold"
              >
                {num}x
              </Button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label className="text-lg font-semibold mb-3 block">Drying Method</Label>
        <div className="space-y-2">
          {[
            { key: 'dryer', label: 'Machine Dryer', icon: '🌀' },
            { key: 'line_dry', label: 'Line Drying / Air Dry', icon: '🧷' },
          ].map(method => (
            <Button
              key={method.key}
              variant={onboardingData.dryingMethod.includes(method.key) ? 'default' : 'outline'}
              onClick={() => handleArrayToggle('dryingMethod', method.key)}
              className="w-full h-16 justify-start px-4"
            >
              <span className="text-2xl mr-3">{method.icon}</span>
              <span>{method.label}</span>
              {onboardingData.dryingMethod.includes(method.key) && <span className="ml-auto text-2xl">✓</span>}
            </Button>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-2">Select all that apply</p>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Trash & Recycling Days</Label>
        <div className="grid grid-cols-3 gap-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <Button
              key={day}
              variant={onboardingData.trashDays.includes(day) ? 'default' : 'outline'}
              onClick={() => handleArrayToggle('trashDays', day)}
              className="h-12"
            >
              {day}
              {onboardingData.trashDays.includes(day) && ' ✓'}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Cleaning Supplies Available?</Label>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={onboardingData.hasCleaningSupplies ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasCleaningSupplies', true)}
            className="h-16"
          >
            ✅ Yes
          </Button>
          <Button
            variant={!onboardingData.hasCleaningSupplies ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasCleaningSupplies', false)}
            className="h-16"
          >
            ❌ No / Need to Buy
          </Button>
        </div>
      </div>
    </div>
  );

  // STEP 4: Pets & Vehicles
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🐾🚗 Pets & Vehicles</h2>
        <p className="text-gray-600">Optional: Add if you have any</p>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Pets (Optional)</Label>
        <div className="space-y-3">
          {[
            { type: 'dog', label: 'Dogs', icon: '🐕' },
            { type: 'cat', label: 'Cats', icon: '🐈' },
            { type: 'bird', label: 'Birds', icon: '🦜' },
            { type: 'small_pet', label: 'Small Pets (hamster, guinea pig, etc.)', icon: '🐹' },
          ].map(pet => {
            const existing = onboardingData.pets.find(p => p.type === pet.type);
            const count = existing ? existing.count : 0;
            
            return (
              <div key={pet.type} className="flex items-center gap-3 p-3 border rounded-lg">
                <span className="text-3xl">{pet.icon}</span>
                <span className="flex-1 font-medium">{pet.label}</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removePet(pet.type)}
                    disabled={count === 0}
                    className="h-8 w-8 p-0"
                  >
                    −
                  </Button>
                  <span className="w-8 text-center font-bold">{count}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addPet(pet.type)}
                    className="h-8 w-8 p-0"
                  >
                    +
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Vehicles (Optional)</Label>
        <div className="space-y-3">
          {onboardingData.vehicles.map(vehicle => (
            <div key={vehicle.id} className="flex items-center gap-3 p-3 border rounded-lg bg-blue-50">
              <span className="text-2xl">🚗</span>
              <span className="flex-1">
                {vehicle.type} - {vehicle.shared ? 'Shared' : 'Personal'}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => removeVehicle(vehicle.id)}
                className="h-8"
              >
                Remove
              </Button>
            </div>
          ))}
          
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button
              variant="outline"
              onClick={() => addVehicle('Car', true)}
              className="h-12"
            >
              + Shared Car
            </Button>
            <Button
              variant="outline"
              onClick={() => addVehicle('Car', false)}
              className="h-12"
            >
              + Personal Car
            </Button>
          </div>
        </div>
        {onboardingData.vehicles.length === 0 && (
          <p className="text-sm text-gray-500 text-center mt-2">No vehicles added (that's okay!)</p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Why we ask:</strong> Pets and vehicles add recurring chores that affect fair distribution.
        </p>
      </div>
    </div>
  );

  // STEP 5: Time Reality
  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">⏰ Your Availability</h2>
        <p className="text-gray-600">When are you typically available for chores?</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-yellow-800">
          ⚡ <strong>Important:</strong> Chores will only be assigned during your available hours. Be realistic!
        </p>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Weekday Availability (Mon-Fri)</Label>
        <p className="text-sm text-gray-600 mb-2">Typical hours you can do chores</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Start Time</Label>
            <Input
              type="time"
              value={onboardingData.availability.mondayToFriday.start}
              onChange={(e) => handleNestedChange('availability', 'mondayToFriday', {
                ...onboardingData.availability.mondayToFriday,
                start: e.target.value
              })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm">End Time</Label>
            <Input
              type="time"
              value={onboardingData.availability.mondayToFriday.end}
              onChange={(e) => handleNestedChange('availability', 'mondayToFriday', {
                ...onboardingData.availability.mondayToFriday,
                end: e.target.value
              })}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Weekend Availability (Sat-Sun)</Label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Start Time</Label>
            <Input
              type="time"
              value={onboardingData.availability.weekend.start}
              onChange={(e) => handleNestedChange('availability', 'weekend', {
                ...onboardingData.availability.weekend,
                start: e.target.value
              })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm">End Time</Label>
            <Input
              type="time"
              value={onboardingData.availability.weekend.end}
              onChange={(e) => handleNestedChange('availability', 'weekend', {
                ...onboardingData.availability.weekend,
                end: e.target.value
              })}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Low Energy Days (Optional)</Label>
        <p className="text-sm text-gray-600 mb-2">Days you'd prefer lighter chores</p>
        <div className="grid grid-cols-3 gap-2">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
            <Button
              key={day}
              variant={onboardingData.availability.lowEnergyDays.includes(day) ? 'default' : 'outline'}
              onClick={() => {
                const current = onboardingData.availability.lowEnergyDays;
                handleNestedChange('availability', 'lowEnergyDays', 
                  current.includes(day) ? current.filter(d => d !== day) : [...current, day]
                );
              }}
              className="h-12"
            >
              {day.slice(0, 3)}
              {onboardingData.availability.lowEnergyDays.includes(day) && ' ✓'}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  // STEP 6: Personal Limits
  const renderStep6 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🎯 Personal Preferences</h2>
        <p className="text-gray-600">Help us assign fair tasks</p>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Chore Aversions (Optional)</Label>
        <p className="text-sm text-gray-600 mb-2">Tasks you'd prefer to avoid</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'grossness', label: 'Gross Tasks', icon: '🤢' },
            { key: 'physical', label: 'Heavy Physical', icon: '💪' },
            { key: 'outdoor', label: 'Outdoor Work', icon: '🌳' },
            { key: 'pets', label: 'Pet Care', icon: '🐾' },
          ].map(aversion => (
            <Button
              key={aversion.key}
              variant={onboardingData.choreAversions.includes(aversion.key) ? 'default' : 'outline'}
              onClick={() => handleArrayToggle('choreAversions', aversion.key)}
              className="h-16 justify-start px-4"
            >
              <span className="text-2xl mr-3">{aversion.icon}</span>
              <span>{aversion.label}</span>
              {onboardingData.choreAversions.includes(aversion.key) && <span className="ml-auto">✓</span>}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Preferred Tasks (Optional)</Label>
        <p className="text-sm text-gray-600 mb-2">Tasks you actually enjoy</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'cooking', label: 'Cooking', icon: '🍳' },
            { key: 'organizing', label: 'Organizing', icon: '📦' },
            { key: 'cleaning', label: 'Cleaning', icon: '🧹' },
            { key: 'outdoor', label: 'Yard Work', icon: '🌱' },
          ].map(pref => (
            <Button
              key={pref.key}
              variant={onboardingData.preferredTasks.includes(pref.key) ? 'default' : 'outline'}
              onClick={() => handleArrayToggle('preferredTasks', pref.key)}
              className="h-16 justify-start px-4"
            >
              <span className="text-2xl mr-3">{pref.icon}</span>
              <span>{pref.label}</span>
              {onboardingData.preferredTasks.includes(pref.key) && <span className="ml-auto">✓</span>}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-sm text-purple-800">
          🧠 <strong>Smart scheduling:</strong> We calculate your realistic daily capacity from your schedule and the chores at hand — no manual limits needed.
        </p>
      </div>
    </div>
  );

  // STEP 7: Talent Spec Selection
  const renderStep7 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">⚔️ Choose Your Path</h2>
        <p className="text-gray-600">Select your initial talent specialization</p>
      </div>

      <div className="space-y-4">
        {[
          {
            key: 'self_care',
            name: 'Self-Care Specialist',
            icon: '💚',
            description: 'Focus on pacing, sustainability, and flexibility. Avoid burnout and maintain work-life balance.',
            benefits: ['Reduce verification frequency', 'Flexible scheduling', 'Rest day bonuses']
          },
          {
            key: 'teamwork',
            name: 'Teamwork Champion',
            icon: '🤝',
            description: 'Excel at coordination, synergy, and helping others. Strengthen household bonds.',
            benefits: ['Shared task bonuses', 'Help teammate actions', 'Communication perks']
          },
          {
            key: 'housework',
            name: 'Housework Master',
            icon: '🏆',
            description: 'Maximize efficiency, specialization, and speed. Complete chores faster and better.',
            benefits: ['XP multipliers', 'Specialization bonuses', 'Speed completion rewards']
          }
        ].map(spec => (
          <Button
            key={spec.key}
            variant={onboardingData.initialTalentSpec === spec.key ? 'default' : 'outline'}
            onClick={() => handleInputChange('initialTalentSpec', spec.key)}
            className="w-full h-auto p-6 flex flex-col items-start text-left"
          >
            <div className="flex items-center gap-3 mb-2 w-full">
              <span className="text-4xl">{spec.icon}</span>
              <span className="text-xl font-bold">{spec.name}</span>
              {onboardingData.initialTalentSpec === spec.key && <span className="ml-auto text-2xl">✓</span>}
            </div>
            <p className="text-sm opacity-80 mb-2">{spec.description}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {spec.benefits.map(benefit => (
                <span key={benefit} className="text-xs bg-white/20 px-2 py-1 rounded">
                  {benefit}
                </span>
              ))}
            </div>
          </Button>
        ))}
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-4">
        <p className="text-sm text-purple-900">
          🌟 <strong>Don't worry!</strong> You can unlock hybrid talents later as you level up. This is just your starting focus.
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">🏰 Kingdom Setup</DialogTitle>
        </DialogHeader>
        <div className="p-6">
          {renderProgressBar()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
          
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
              disabled={
                (step === 1 && (!onboardingData.householdName || !onboardingData.adminName))
              }
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6"
            >
              {step === 6 ? '🚀 Launch Kingdom!' : 'Next →'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProgressiveOnboarding;
