# FinBalanza 1.6.1 — entrega para compilar y probar

Fecha: 8 de octubre de 2026. Proyecto modificado sobre una copia del ZIP original.
No se ha certificado para producción: faltan compilación nativa, pruebas en iPhone y recepción en Meta Events Manager.
Por decisión expresa del propietario, no se compiló en EAS ni se transfirieron las variables de AppsFlyer.

## Cambios implementados

- `CompleteRegistration`: se usa la constante estándar `AppEventsLogger.AppEvents.CompletedRegistration` (nombre nativo `fb_mobile_complete_registration`), inmediatamente después de que `addDoc` confirma la creación de la solicitud en `leads`. No se dispara por actualizaciones de verificación ni por guardados fallidos. El ID del documento solo deduplica localmente en memoria; no se envían campos del solicitante. Los errores de Meta se capturan y no bloquean la navegación.
- `AdImpression`: se usa la constante estándar del SDK con `valueToSum` numérico y `fb_currency`, `fb_ad_type`, `ad_placement`, `ad_platform` y `revenue_precision` cuando está disponible. No se registra como compra ni se calcula mediante eCPM.
- `FirstAdImpression`: evento personalizado sin valor monetario adicional, con marca en AsyncStorage y reserva síncrona contra concurrencia. Los eventos normales se envían independientemente de la lectura/escritura de esa marca.
- Meta: eliminado el plugin duplicado; inicialización explícita e idempotente; sincronización de ATT al resolver la solicitud existente y al volver a primer plano. La recolección de identificadores publicitarios solo se habilita con `granted`. Se conservan `app_open` y todos los eventos de Firebase/AppsFlyer existentes. Los valores por defecto previos de auto-inicialización y eventos automáticos se hicieron explícitos (`false`); no se añadieron eventos automáticos de instalación.
- CPA: en `app/offers.js`, las dos asignaciones de `sub1=iosnew` ahora son `sub1=FinBalanza`, con sus comentarios actualizados. Se conserva la lógica previa de `sub2`: sustituirlo por el lead actual o quitarlo si no existe lead. `sub3`, los demás parámetros, sus escapes, dominio, ruta y fragmento permanecen iguales. No se editaron ofertas de Firestore.
- `.npmrc`: mismo `legacy-peer-deps=true`, convertido de UTF-16 a UTF-8 para que npm lo interprete.
- No se actualizaron dependencias. El lockfile solo cambia la versión del proyecto.

## Ubicaciones instrumentadas

| Pantalla | Formatos | Fuente del ingreso |
| --- | --- | --- |
| `app/analyzing.js` | Interstitial | `AdEventType.PAID` |
| `app/verification.js` | Interstitial | `AdEventType.PAID` |
| `app/home.js` | Interstitial y banner | `PAID` y `onPaid` |
| `app/offers.js` | Banner | `onPaid` |
| `app/waiting.js` | Banner | `onPaid` |

No hay otras instancias reales de anuncios en el código. El ID de native ad existe en `src/admob.js`, pero no hay un anuncio nativo renderizado que instrumentar.
Los interstitials originales son objetos de módulo: cada uno recibe una sola suscripción PAID, protegida por WeakSet, durante toda su vida. Los banners mantienen su tracker entre renders y abren un nuevo ciclo al cargar/refrescar el anuncio. Dos impresiones diferentes con el mismo importe no se deduplican entre sí. No cambiaron los IDs, las solicitudes, `load()`, `show()`, temporizadores ni frecuencia de los anuncios.

## Importe y límites de entrega

Se verificó el código publicado de `react-native-google-mobile-ads@16.0.1`: iOS entrega directamente `GADAdValue.value`; Android convierte internamente los micros a unidades monetarias. Por tanto, `0.001234 USD` se envía como el número `0.001234`, sin dividirlo otra vez entre un millón y sin redondearlo a centavos.

Se conserva el cero que devuelva el SDK; no se inventa un importe positivo. Se rechazan valores inválidos, negativos o monedas distintas de USD. **Verificar en el iPhone que AdMob devuelva `currency: "USD"`**: si devuelve otra moneda, esta implementación omite ese callback y no fabrica una conversión. Haría falta definir una fuente de cambio real para soportar ese caso.

La protección es contra envíos duplicados desde la app; el SDK no confirma entrega individual al servidor. La marca de FirstAdImpression se escribe antes del envío: una interrupción justo después puede perder ese evento único, pero evita repetirlo. Si el almacenamiento falla, se omite solo ese evento y los AdImpression normales continúan. No se implementó una cola de reintentos que pudiera duplicar revenue.

La marca corresponde a la vida de los datos locales: persiste al cerrar o actualizar la app. En instalaciones existentes, identifica la primera impresión observada desde esta actualización; no puede reconstruir impresiones históricas. Una restauración de copia de seguridad puede conservar la marca. La deduplicación de registro por ID se mantiene durante la sesión; el flujo existente solo la invoca tras crear un documento nuevo y no reproduce registros al arrancar.

## Versiones verificadas

| Campo | Original | Entrega |
| --- | --- | --- |
| Versión pública Expo | 1.6.0 | 1.6.1 |
| `ios.buildNumber` local | 2 | 8 |
| Versión de package.json/raíz del lockfile | 1.0.0 | 1.6.1 |
| Build remoto de EAS consultado | 7 | 7, sin modificar |

`eas.json` permanece intacto: `appVersionSource: "remote"` y `production.autoIncrement: true`.
La siguiente compilación production debería recibir **8** si nadie compila antes; EAS es la autoridad sobre el número final y omite el build local. Se verificó un build previo terminado de EAS con versión 1.6.0 / build 7. No se consultó App Store Connect ni se publicó nada.

## Archivos modificados y añadidos

Modificados (10):

1. `.npmrc`
2. `app.config.js`
3. `app/_layout.js`
4. `app/analyzing.js`
5. `app/verification.js`
6. `app/home.js`
7. `app/offers.js` — incluye el cambio CPA adicional.
8. `app/waiting.js`
9. `package.json`
10. `package-lock.json`

Añadidos (6):

1. `src/metaEvents.js`
2. `src/adRevenue.js`
3. `tests/meta-events.test.cjs`
4. `tests/offer-links.test.cjs`
5. `.env.example`
6. `LEEME_ENTREGA.md`

`eas.json`, Firebase, AppsFlyer, IDs de anuncios, formularios, estilos y la rama `/balance` se conservan. El selector Firestore `config/app.showWizard` y sus rutas no se modificaron; no se añadió ningún mecanismo especial para revisión de Apple.

## Verificación ejecutada

| Comprobación | Resultado y alcance |
| --- | --- |
| Copia completa del ZIP y SHA-256 | Coincide con el original: `CD042DEDB82E9EE00F51E055D1886780B50C93FBF1D234A4E285020DE7F69235` |
| Instalación desde lockfile | 964 paquetes instalados con `npm ci --legacy-peer-deps --no-audit --no-fund --ignore-scripts`; no valida CocoaPods ni scripts nativos |
| `npm test` | 15/15 pruebas pasan: 10 de Meta/Firestore simulado y 5 de enlaces CPA |
| `npx tsc --noEmit` | Pasa; el proyecto no habilita `checkJs`, por lo que no es una comprobación completa de tipos de los archivos JavaScript |
| Análisis sintáctico | 42 archivos JS/TS/TSX/CJS analizados sin errores |
| Resolución de imports | 209 importaciones de código de aplicación resueltas |
| `npx expo config --type introspect --json` | Pasa; un solo plugin de Meta, IDs conservados, esquema Facebook, ATT y SKAdNetwork presentes |
| Exportación iOS con Hermes | Bundle generado; no equivale a compilar ni ejecutar un binario nativo |
| Comparación estructural con original | Formularios/JSX y estilos, operaciones Firestore, navegación y llamadas de carga/presentación de anuncios intactas, exceptuando los callbacks añadidos |
| Lockfile | Todas las versiones e integridades de dependencias conservadas |
| `npx expo-doctor` | 17/18 comprobaciones pasan; una avisa de cuatro parches recomendados |
| `npx expo install --check` con red | Detecta los mismos cuatro parches pendientes; no se aplicaron |
| `npx expo prebuild --platform ios --no-install` | No ejecutable en este Windows: Expo omite generar iOS y termina con error de plataforma |
| Compilación nativa / iPhone / Meta Events Manager | No ejecutados. Compilación EAS omitida por instrucción del propietario |

Expo recomienda: expo 54.0.34 → ~54.0.37; expo-constants 18.0.13 → ~18.0.14; expo-font 14.0.11 → ~14.0.12; expo-router 6.0.23 → ~6.0.24. Se conservaron las versiones fijadas, pues la exportación pasó y no se demostró que fuera necesario actualizarlas.

El primer intento de exportación falló por permisos al escribir el archivo temporal de Hermes; se repitió correctamente con TEMP/TMP dentro de la carpeta de trabajo. Otros intentos iniciales de instalación estuvieron limitados por red/rutas de Windows; la instalación final y los resultados de la tabla son los ejecutados después de resolver esas limitaciones.

## Compilar con EAS

1. Extraer el ZIP en una ruta corta y entrar en `FinBalanzaCODE`. Usar Node 20.19 o posterior compatible con Expo SDK 54.
2. Restaurar el `.env` original para desarrollo local, o copiar `.env.example` a `.env` y completar **la misma AF_DEV_KEY original**. `IOS_APP_ID=6775662558` se conserva. No publicar ese archivo ni cambiar IDs.
3. Antes de compilar, configurar personalmente `AF_DEV_KEY` e `IOS_APP_ID` en las variables **Sensitive** del proyecto EAS `dacan/finbalanza`, ambiente `production` (y `development` si se usa ese perfil). La consulta efectuada no encontró variables Plain text/Sensitive en production. `.env` está ignorado por Git/EAS: restaurarlo localmente no garantiza que exista en el servidor. Sin estas variables AppsFlyer omite su inicialización. No se transfirieron valores durante este trabajo.
4. Ejecutar:

```sh
npm ci
npm test
npx tsc --noEmit
npx expo-doctor
npx eas-cli login
npx eas-cli build:version:get --platform ios --profile production
npx eas-cli build --platform ios --profile production
```

EAS puede solicitar inicializar Git si se parte del ZIP. Revisar que `.env` y archivos de firma sigan excluidos antes de confirmar el commit. El perfil production usa las credenciales iOS de tu cuenta y genera un build de distribución App Store/TestFlight. No usar `--auto-submit` hasta decidir enviarlo. Confirmar en EAS el `version=1.6.1` y el build asignado mayor que el anterior. No reducir el contador remoto.

Para instalar un development build en un iPhone registrado:

```sh
npx eas-cli device:create
npx eas-cli build --platform ios --profile development
npx expo start --dev-client
```

No usar Expo Go: estos SDK requieren código nativo. El perfil development con Metro usa los IDs de prueba existentes mediante `__DEV__`. Los perfiles preview/production usan los IDs reales existentes; registrar el dispositivo como dispositivo de prueba en AdMob para las comprobaciones de anuncios. No generar clics artificiales en anuncios reales.

## Pruebas pendientes en iPhone y Meta

1. En AdMob, comprobar que están habilitados los ingresos a nivel de impresión. Una carga o apertura sin callback PAID no genera revenue. Las impresiones de prueba pueden devolver cero o no permitir validar revenue real.
2. En Meta Events Manager, seleccionar la app/origen de datos asociado al App ID `1392210272341084` y abrir los eventos de prueba/diagnósticos disponibles. Usar una cuenta/dispositivo de prueba con acceso a esa app. No añadir `test_event_code` al SDK móvil como si fuera Conversions API. El envío del SDK puede agruparse y no aparecer instantáneamente.
3. Instalar, aceptar ATT y completar una solicitud de prueba autorizada. Confirmar primero el documento en Firestore y después un solo registro estándar en Meta (`CompleteRegistration`/registro completado; internamente `fb_mobile_complete_registration`). Revisar que no incluya nombre, email, teléfono, ID de lead ni importes del formulario.
4. Simular un guardado fallido en un entorno de prueba: cero eventos de registro. No cambiar las reglas de Firestore de producción para esta prueba. La app mantiene su tratamiento previo de errores de guardado.
5. Recorrer las seis ubicaciones instrumentadas. Comparar cada valor del callback AdMob con el valor numérico de AdImpression en Meta, incluyendo fracciones pequeñas y `fb_currency=USD`. Verificar formato y placement. No sumar FirstAdImpression al revenue.
6. Esperar auto-refresh de banners, salir/volver a pantallas y mostrar interstitials según su flujo normal. Contar un evento por callback monetizado/ciclo, incluyendo dos impresiones con el mismo valor. Verificar que la frecuencia y la navegación se mantienen.
7. Primera impresión: un FirstAdImpression y un AdImpression. Impresiones siguientes y reinicio: únicamente AdImpression. Probar en instalación limpia sin restauración de datos y en actualización desde la versión anterior.
8. Repetir con ATT denegado y con cambios de permiso en Ajustes. No debe habilitarse IDFA sin consentimiento; los eventos pueden tener atribución limitada. Comprobar que la solicitud ATT existente se presenta correctamente junto al permiso push en dispositivo real.
9. Confirmar ambas experiencias existentes sin alterar `showWizard` para la revisión de Apple. La rama balance no contiene anuncios ni solicitudes CPA; no se esperan allí eventos monetizados.
10. Abrir una oferta de prueba y verificar, por ejemplo, `https://cpa.example/offer?l=77&sub1=FinBalanza&sub2=LEAD&sub3=original#section`. El dominio del ejemplo es ficticio; las URLs reales conservan su dominio y ruta. No se probaron conversiones ni redirecciones de la red CPA externa.
11. Revisar en Meta/AppsFlyer si existen postbacks o integraciones externas que ya envíen estos mismos eventos. No se modificaron paneles ni campañas y no se puede certificar ausencia de duplicados externos desde el ZIP. Recibir eventos no garantiza por sí solo elegibilidad para optimización por valor/ROAS.

## Otros hallazgos y contenido del ZIP

- Falta `androidAppId` de AdMob en la configuración original y el árbol Android generado tiene identificadores inconsistentes. Esta entrega se dirige a iOS; no se inventó un ID Android ni se corrigió esa plataforma.
- `app/daily-verify.js` estaba vacío aunque la ruta está declarada. Permanece igual; no forma parte del nuevo tracking.
- No se repararon los manejadores de errores de negocio preexistentes ni se refactorizó código ajeno a los cambios solicitados.
- Se excluyen del ZIP final: `.env` (secreto), `.expo/` y `.claude/` (estado/configuración local generada), `android/` (árbol generado ya ignorado por el `.gitignore` original e innecesario para EAS iOS), `node_modules/` y artefactos de pruebas/exportación. EAS genera el proyecto iOS a partir de Expo.
- Se conservan `GoogleService-Info.plist`, la configuración cliente de Firebase y el App ID/client token de Meta: son configuración cliente necesaria, no claves de servidor. El token cliente de Meta no es un App Secret.
- La copia de seguridad completa, incluyendo el `.env` original, quedó localmente en `work/FinBalanzaCODE.original.zip` dentro de la carpeta de este chat. No se incluye en la entrega descargable para no redistribuir secretos.

## Fuentes consultadas

- [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/).
- [Versionado local y remoto en EAS](https://docs.expo.dev/build-reference/app-versions/).
- [Callbacks de ingresos de React Native Google Mobile Ads](https://docs.page/invertase/react-native-google-mobile-ads/impression-level-ad-revenue), contrastados con el código instalado exacto 16.0.1 en iOS, Android y BaseAd.
- [Ingresos a nivel de impresión en AdMob iOS](https://developers.google.com/admob/ios/impression-level-ad-revenue).
- [Inicialización/configuración de react-native-fbsdk-next](https://github.com/thebergamo/react-native-fbsdk-next), contrastada con el plugin, el adaptador Expo y los métodos nativos de 13.4.1 (FBSDK iOS ~18.0).
