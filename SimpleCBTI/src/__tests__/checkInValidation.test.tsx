import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { CheckInView } from '../screens/DailyInsightScreen';
import { en } from '../i18n/locales/en';
jest.mock('../services/sleepStore',()=>({sessionKey:(r:any)=>r.id??r.date}));
jest.mock('expo-haptics',()=>({}));
jest.mock('expo-localization',()=>({getLocales:()=>[]}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0})}));
jest.mock('../hooks/useSleepStore',()=>({useSleepStore:jest.fn()}));
jest.mock('../hooks/useProStatus',()=>({useProStatus:jest.fn()}));
jest.mock('../components/StarRating',()=>({StarRating:(props:unknown)=>require('react').createElement('Rating',props)}));
jest.mock('react-native',()=>({
 View:'View',Text:'Text',ScrollView:'ScrollView',Pressable:'Pressable',TextInput:'TextInput',TouchableOpacity:'TouchableOpacity',
 Keyboard:{dismiss:jest.fn()},StyleSheet:{create:(s:unknown)=>s},Animated:{Value:class {},View:'AnimatedView',timing:()=>({start:()=>{}})},
}));
let renderer:ReactTestRenderer;
const complete=jest.fn(),anchor=jest.fn(),focus=jest.fn();
const submit=async()=>{await act(async()=>renderer.root.findByType('Pressable' as never).props.onPress());await act(async()=>jest.advanceTimersByTime(20));};
const input=async(label:string,value:string)=>act(async()=>renderer.root.findByProps({accessibilityLabel:label}).props.onChangeText(value));
const content=()=>JSON.stringify(renderer.toJSON());
beforeEach(async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 jest.useFakeTimers();jest.clearAllMocks();
 const original=console.error;
 jest.spyOn(console,'error').mockImplementation((...args)=>{if(!String(args[0]).startsWith('react-test-renderer is deprecated')) original(...args);});
 (globalThis as any).requestAnimationFrame=(fn:()=>void)=>setTimeout(fn,16);
 await act(async()=>{renderer=create(<CheckInView bedtime={new Date()} wakeTime={new Date()} techniqueIds={['SC01','CR01','MR01']} onComplete={complete} onInvalidField={anchor} t={en} isPro={true}/>,{createNodeMock:()=>({focus})});});
 await act(async()=>renderer.root.findAllByType('View' as never).filter(n=>n.props.onLayout).forEach((n,i)=>n.props.onLayout({nativeEvent:{layout:{y:i*100}}})));
});
afterEach(async()=>{await act(async()=>renderer.unmount());jest.restoreAllMocks();jest.useRealTimers();});
test('missing fields scroll in order, all three check-ins required, na accepted, duplicate submit blocked',async()=>{
 // Both minute fields stay blank and must be saved as zero.
 await submit();expect(content()).toContain(en.validationSatisfaction);expect(anchor).toHaveBeenLastCalledWith(300);expect(complete).not.toHaveBeenCalled();
 await act(async()=>renderer.root.findByType('Rating' as never).props.onChange(4));
 await submit();expect(content()).toContain(en.validationTechnique);
 const choices=renderer.root.findAllByType('TouchableOpacity' as never);
 for(let i=0;i<3;i++){
   expect(complete).not.toHaveBeenCalled();
   await act(async()=>choices[i*3+1].props.onPress()); // Not applicable is an explicit answer.
   await submit();
 }
 await submit();
 await act(async()=>jest.advanceTimersByTime(2100));
 expect(complete).toHaveBeenCalledTimes(1);
 expect(complete.mock.calls[0][0]).toMatchObject({sleepOnsetMinutes:0,nightWakeMinutes:0,satisfaction:4,techniqueResponses:{SC01:'na',CR01:'na',MR01:'na'}});
});
test.each([' ', '-1', '1.5', '12x'])('rejects invalid minute value %s',async value=>{
 await input(en.sleepOnsetLabel,value);await submit();expect(content()).toContain(en.validationMinutes);expect(anchor).toHaveBeenLastCalledWith(100);expect(focus).toHaveBeenCalled();expect(complete).not.toHaveBeenCalled();
});
test('optional WASO accepts blank but rejects invalid text',async()=>{
 await input(en.sleepOnsetLabel,'10');await input(en.nightWakeLabel,'bad');await submit();expect(anchor).toHaveBeenLastCalledWith(200);expect(complete).not.toHaveBeenCalled();
});
