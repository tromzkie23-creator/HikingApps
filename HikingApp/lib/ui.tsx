import {Text,TextInput,Pressable,View,StyleSheet,TextInputProps} from 'react-native';
import {C} from './theme';
export const Btn=({t,onPress,alt}:{t:string;onPress:()=>void;alt?:boolean})=>(
<Pressable onPress={onPress} style={[s.btn,alt&&s.alt]}><Text style={[s.bt,alt&&{color:C.spruce}]}>{t}</Text></Pressable>);
export const Field=({label,...p}:TextInputProps&{label:string})=>(
<View style={{marginBottom:14}}><Text style={s.lb}>{label}</Text><TextInput {...p} placeholderTextColor={C.mute} autoCapitalize="none" style={s.in}/></View>);
const s=StyleSheet.create({
btn:{backgroundColor:C.spruce,padding:15,borderRadius:10,alignItems:'center'},
alt:{backgroundColor:'transparent',borderWidth:1.5,borderColor:C.spruce},
bt:{color:C.white,fontSize:16,fontWeight:'700'},
lb:{color:C.ink,fontWeight:'600',marginBottom:6},
in:{backgroundColor:C.white,borderWidth:1,borderColor:C.line,borderRadius:10,padding:13,fontSize:16,color:C.ink}});
