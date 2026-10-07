import {Tabs} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {C} from '../../lib/theme';
const ic=(n:any)=>({color,size}:any)=><Ionicons name={n} size={size} color={color}/>;
export default function T(){return(<Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:C.spruce}}>
<Tabs.Screen name="index" options={{title:'Trails',tabBarIcon:ic('trail-sign-outline')}}/>
<Tabs.Screen name="history" options={{title:'History',tabBarIcon:ic('time-outline')}}/>
<Tabs.Screen name="profile" options={{title:'Profile',tabBarIcon:ic('person-outline')}}/></Tabs>);}
