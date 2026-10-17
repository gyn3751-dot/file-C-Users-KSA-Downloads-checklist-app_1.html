import ctypes, numpy as np, os, espeakng_loader as L
lib=ctypes.CDLL(L.get_library_path())
CB=ctypes.CFUNCTYPE(ctypes.c_int,ctypes.POINTER(ctypes.c_short),ctypes.c_int,ctypes.c_void_p)
_buf=[]
def _cb(wav,n,ev):
    if n>0: _buf.append(np.ctypeslib.as_array(wav,shape=(n,)).copy())
    return 0
_cbf=CB(_cb)
SR=lib.espeak_Initialize(2,0,os.path.dirname(L.get_data_path()).encode(),0)
lib.espeak_SetSynthCallback(_cbf)
def say(text,voice=b'ko',rate=130,pitch=50):
    lib.espeak_SetVoiceByName(voice)
    lib.espeak_SetParameter(1,rate,0); lib.espeak_SetParameter(3,pitch,0)
    _buf.clear(); t=text.encode('utf-8')
    lib.espeak_Synth(t,len(t)+1,0,0,0,1,None,None); lib.espeak_Synchronize()
    a=np.concatenate(_buf) if _buf else np.zeros(1,np.int16)
    return a.astype(np.float64)/32768, SR
if __name__=='__main__':
    import wave,sys
    a,sr=say('반짝이는 하루를 채우는')
    print(sr,len(a)/sr)
    with wave.open(sys.argv[1],'wb') as w: w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((a*32767).astype('<i2').tobytes())
