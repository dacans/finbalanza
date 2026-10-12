import * as Clarity from '@microsoft/react-native-clarity';
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdEventType, BannerAd, BannerAdSize, InterstitialAd } from "react-native-google-mobile-ads";
import { COLORS } from "../constants/theme";
import { trackInterstitialRevenue, useBannerRevenue } from "../src/adRevenue";
import { AD_UNITS } from "../src/admob";
import { logEvent } from "../src/analytics";
import { getRemoteConfig } from "../src/config/remoteConfig";
import { firestore } from "../src/firebase";
import { REQUISITOS, RESULTADO } from "../src/router/config";
import { esCps, ordenar, recomendada as calcularRecomendada } from "../src/router/router";
import {
  decidirExploracion,
  getEstado,
  getPerfil,
  guardarYaCliente,
  limpiarPendiente,
  marcarVistaOfertas,
  prepararClic,
  registrarResultado,
} from "../src/user/userStore";
import { getOffers, loadOffers, offersStale } from "../utils/offersCache";

// Ofertas — igual que Android MX 1.4:
//   lista (1 "Compatible con tu perfil" arriba + otras, ordenadas por el router según el tier)
//   → CPS: "Ten a la mano INE y CLABE" → navegador dentro de la app con sub1..sub4
//   → al cerrarlo "¿Cómo te fue?" → intersticial → la cascada baja lo ya intentado.

const interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
  requestNonPersonalizedAdsOnly: true,
});
trackInterstitialRevenue(interstitial, "offer_return");

const NOTA_RESULTADO = {
  [RESULTADO.APROBADO]: "Te aprobaron aquí",
  [RESULTADO.RECHAZADO]: "Ya la intentaste",
  [RESULTADO.FALTA_REQUISITO]: "Te faltó un requisito",
  [RESULTADO.DESPUES]: "Solicitud sin terminar",
};

export default function Offers() {
  const router = useRouter();
  const bannerRevenue = useBannerRevenue("offers");
  const [cargando, setCargando] = useState(true);
  const [todas, setTodas] = useState([]);
  const [perfil, setPerfil] = useState(null);
  const [estado, setEstado] = useState(null);
  // { tipo: "lista" } | { tipo: "preparar", oferta } | { tipo: "resultado", oferta }
  const [fase, setFase] = useState({ tipo: "lista" });
  const [pidiendoRequisito, setPidiendoRequisito] = useState(false);
  const [yaClienteSel, setYaClienteSel] = useState([]);
  const enNavegadorRef = useRef(false);
  const omitidoRef = useRef(false);
  const ocupadoRef = useRef(false);

  const cargar = useCallback(async () => {
    let lista = getOffers();
    if (offersStale()) lista = await loadOffers(firestore);
    const p = await getPerfil();
    let e = await getEstado();
    if (e.explorar === null || e.explorar === undefined) e = await decidirExploracion(getRemoteConfig().exploracionPct);
    setTodas(lista);
    setPerfil(p);
    setEstado(e);
    setCargando(false);
    // Volvió a la app con una oferta abierta sin contestar → "¿Cómo te fue?"
    if (e.pendiente && !enNavegadorRef.current && !omitidoRef.current) {
      const pend = lista.find((o) => o.clave === e.pendiente);
      if (pend) setFase((f) => (f.tipo === "lista" ? { tipo: "resultado", oferta: pend } : f));
    }
  }, []);

  useEffect(() => {
    try { Clarity.setCustomTag("screen", "offers"); } catch {}
    marcarVistaOfertas();
    interstitial.load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const ordenadas = estado
    ? ordenar({
        activas: todas,
        perfil,
        yaCliente: estado.yaCliente,
        explorar: estado.explorar === true,
        semilla: estado.semilla,
        resultados: estado.resultados,
      })
    : [];
  const resultados = estado ? estado.resultados : {};
  const aprobado = Object.values(resultados).includes(RESULTADO.APROBADO);
  const recomendada = calcularRecomendada(ordenadas, resultados);
  const otras = ordenadas.filter((o) => o.clave !== recomendada?.clave);
  const vieneDeRechazo = estado && [RESULTADO.RECHAZADO, RESULTADO.FALTA_REQUISITO].includes(estado.ultimoResultado);
  const preguntarYaCliente = !cargando && estado && !estado.yaClienteRespondido && todas.length > 1 && fase.tipo === "lista";

  const [titulo, subtitulo] = aprobado
    ? ["¡Felicidades por tu aprobación!", "Si necesitas más, aquí tienes otras opciones."]
    : vieneDeRechazo && recomendada
      ? ["Probemos con otra opción", "Esta también es compatible con tu perfil."]
      : perfil
        ? ["¡Ya están listas!", `Encontramos ${ordenadas.length} opciones compatibles con tu perfil`]
        : ["¡Ya están listas!", `Encontramos ${ordenadas.length} opciones de préstamos para tu perfil`];

  /** Botón de una tarjeta. CPS → primero "ten a la mano…"; CPL (comparadores) → directo. */
  const verOferta = (oferta) => {
    if (esCps(oferta)) {
      logEvent("offer_prep", { oferta_id: oferta.clave, tier: perfil ? perfil.tier : "X" });
      setFase({ tipo: "preparar", oferta });
    } else {
      abrir(oferta);
    }
  };

  const abrir = async (oferta) => {
    if (!oferta.url || ocupadoRef.current) return;
    ocupadoRef.current = true;
    enNavegadorRef.current = true;
    omitidoRef.current = false;
    try {
      const posicion = ordenadas.findIndex((o) => o.clave === oferta.clave) + 1;
      // Se precarga ya: cuando vuelva y conteste, el intersticial tiene que estar listo
      if (!interstitial.loaded) interstitial.load();
      const url = await prepararClic(oferta, perfil, posicion, oferta.clave === recomendada?.clave);
      setFase({ tipo: "lista" });
      try {
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          dismissButtonStyle: "close",
        });
      } catch {
        await Linking.openURL(url);
      }
      // Cerró el navegador → "¿Cómo te fue?"
      setPidiendoRequisito(false);
      setFase({ tipo: "resultado", oferta });
      setEstado(await getEstado());
    } catch {
      // nunca dejar la pantalla bloqueada
    } finally {
      enNavegadorRef.current = false;
      ocupadoRef.current = false;
    }
  };

  const mostrarAnuncio = () => {
    try {
      if (interstitial.loaded) {
        const unsub = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
          unsub();
          interstitial.load();
        });
        interstitial.show();
      } else {
        interstitial.load();
      }
    } catch {}
  };

  const responder = async (oferta, resultado, requisito = null) => {
    await registrarResultado(oferta, resultado, requisito, perfil);
    setPidiendoRequisito(false);
    setFase({ tipo: "lista" });
    await cargar();
    mostrarAnuncio();
  };

  /** "No la abrí · volver a las ofertas" */
  const descartarResultado = async () => {
    await limpiarPendiente();
    setPidiendoRequisito(false);
    setFase({ tipo: "lista" });
    setEstado(await getEstado());
  };

  const confirmarYaCliente = async () => {
    await guardarYaCliente(yaClienteSel);
    setEstado(await getEstado());
  };

  // ── Fases ────────────────────────────────────────────────────────────────

  const renderPreparar = (oferta) => (
    <View style={styles.fase}>
      <Text style={styles.faseTitulo}>Antes de continuar con {oferta.titulo}</Text>
      <Text style={styles.faseTexto}>Ten esto a la mano para que tu solicitud avance más rápido:</Text>
      <View style={styles.requisitosCard}>
        <Requisito texto="INE vigente (foto de frente y reverso)" />
        <Requisito texto={perfil?.soloTarjeta ? "Tu tarjeta de débito a tu nombre" : "Tu CLABE interbancaria (18 dígitos) a tu nombre"} />
        <Requisito texto="Celular y correo propios" />
      </View>
      <Text style={styles.tip}>
        Tip: toma las fotos con buena luz y sin reflejos, y escribe tus datos igual que en tu INE. Son las razones más comunes de rechazo.
      </Text>
      <Pressable style={styles.offerBtn} onPress={() => abrir(oferta)}>
        <Text style={styles.offerBtnText}>Continuar a {oferta.titulo}</Text>
      </Pressable>
      <Pressable style={styles.linkBtn} onPress={() => setFase({ tipo: "lista" })}>
        <Text style={styles.linkBtnText}>Volver a las ofertas</Text>
      </Pressable>
    </View>
  );

  const renderResultado = (oferta) => (
    <View style={styles.fase}>
      <Text style={styles.faseTitulo}>¿Cómo te fue con {oferta.titulo}?</Text>
      <Text style={styles.faseTexto}>
        {pidiendoRequisito ? "¿Qué te pidió que no tienes?" : "Cuéntanos y te mostramos la mejor siguiente opción para tu perfil."}
      </Text>
      {!pidiendoRequisito ? (
        <>
          <Opcion texto="✅  ¡Me aprobaron!" onPress={() => responder(oferta, RESULTADO.APROBADO)} />
          <Opcion texto="❌  Me rechazaron" onPress={() => responder(oferta, RESULTADO.RECHAZADO)} />
          <Opcion texto="📄  Me pidió algo que no tengo" onPress={() => setPidiendoRequisito(true)} />
          <Opcion texto="⏳  Lo termino después" onPress={() => responder(oferta, RESULTADO.DESPUES)} />
          <Pressable style={styles.linkBtn} onPress={descartarResultado}>
            <Text style={styles.linkBtnText}>No la abrí · volver a las ofertas</Text>
          </Pressable>
        </>
      ) : (
        <>
          {REQUISITOS.map(([codigo, texto]) => (
            <Opcion key={codigo} texto={texto} onPress={() => responder(oferta, RESULTADO.FALTA_REQUISITO, codigo)} />
          ))}
          <Pressable style={styles.linkBtn} onPress={() => setPidiendoRequisito(false)}>
            <Text style={styles.linkBtnText}>Atrás</Text>
          </Pressable>
        </>
      )}
    </View>
  );

  const renderTarjeta = (oferta, esRecomendada) => {
    const r = resultados[oferta.clave];
    const enProceso = r === RESULTADO.DESPUES;
    return (
      <View key={oferta.clave} style={[styles.card, esRecomendada && styles.cardRecomendada]}>
        {esRecomendada ? (
          <View style={styles.recoBadge}>
            <Text style={styles.recoBadgeText}>COMPATIBLE CON TU PERFIL</Text>
          </View>
        ) : null}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{oferta.titulo}</Text>
            {oferta.descripcion ? <Text style={styles.cardSubtitle}>{oferta.descripcion}</Text> : null}
            {r ? <Text style={styles.cardNota}>{NOTA_RESULTADO[r]}</Text> : null}
          </View>
          <View style={styles.approvedDot} />
        </View>
        {oferta.amount || oferta.time ? (
          <View style={styles.cardStats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Monto</Text>
              <Text style={styles.statValue}>{oferta.amount || "—"}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Tiempo</Text>
              <Text style={styles.statValue}>{oferta.time || "Respuesta rápida"}</Text>
            </View>
          </View>
        ) : null}
        <Pressable style={[styles.offerBtn, !esRecomendada && styles.offerBtnSec]} onPress={() => verOferta(oferta)}>
          <Text style={[styles.offerBtnText, !esRecomendada && styles.offerBtnTextSec]}>
            {esRecomendada ? (enProceso ? "Terminar mi solicitud →" : "Solicitar ahora →") : "Ver oferta →"}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (fase.tipo === "resultado") {
              omitidoRef.current = true; // Atrás en "¿Cómo te fue?" → no se vuelve a preguntar en esta sesión
              setFase({ tipo: "lista" });
            } else if (fase.tipo === "preparar") {
              setFase({ tipo: "lista" });
            } else {
              router.back();
            }
          }}
        >
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Tus ofertas</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {cargando ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        ) : fase.tipo === "preparar" ? (
          renderPreparar(fase.oferta)
        ) : fase.tipo === "resultado" ? (
          renderResultado(fase.oferta)
        ) : ordenadas.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Estamos actualizando las ofertas</Text>
            <Text style={styles.emptySubtitle}>Vuelve a entrar en unas horas para ver las opciones disponibles.</Text>
            <Pressable style={styles.button} onPress={() => router.replace("/home")}>
              <Text style={styles.buttonText}>Volver al inicio</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.headerWrap}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>OFERTAS DISPONIBLES</Text>
              </View>
              <Text style={styles.title}>{titulo}</Text>
              <Text style={styles.subtitle}>{subtitulo}</Text>
            </View>

            {recomendada ? renderTarjeta(recomendada, true) : null}
            {otras.length ? (
              <Text style={styles.seccion}>{recomendada ? "Otras opciones" : "Opciones disponibles"}</Text>
            ) : null}
            {otras.map((o) => renderTarjeta(o, false))}
          </>
        )}

        <View style={styles.bannerWrap}>
          <BannerAd
            onAdLoaded={bannerRevenue.onAdLoaded}
            onPaid={bannerRevenue.onPaid}
            unitId={AD_UNITS.banner}
            size={BannerAdSize.ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Los resultados son orientativos. No garantizamos aprobación.
            FinBalanza no otorga préstamos directamente.
          </Text>
        </View>
      </ScrollView>

      {/* "¿Ya pediste en alguna?" — una sola vez. Donde ya es cliente el CPS paga 0 → se esconde. */}
      <Modal visible={Boolean(preguntarYaCliente)} transparent animationType="fade">
        <View style={styles.modalFondo}>
          <View style={styles.modalCaja}>
            <Text style={styles.modalTitulo}>Antes de empezar</Text>
            <Text style={styles.modalTexto}>¿Ya tienes o ya pediste préstamo en alguna de estas? Marca las que sí.</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {todas.map((o) => {
                const sel = yaClienteSel.includes(o.clave);
                return (
                  <Pressable
                    key={o.clave}
                    style={styles.checkRow}
                    onPress={() => setYaClienteSel((s) => (sel ? s.filter((c) => c !== o.clave) : [...s, o.clave]))}
                  >
                    <View style={[styles.checkBox, sel && styles.checkBoxOn]}>
                      {sel ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.checkText}>{o.titulo}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={[styles.button, { marginTop: 14 }]} onPress={confirmarYaCliente}>
              <Text style={styles.buttonText}>{yaClienteSel.length ? "Listo" : "Ninguna"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Requisito({ texto }) {
  return (
    <View style={styles.requisitoRow}>
      <Text style={styles.requisitoCheck}>✓</Text>
      <Text style={styles.requisitoTexto}>{texto}</Text>
    </View>
  );
}

function Opcion({ texto, onPress }) {
  return (
    <Pressable style={styles.opcion} onPress={onPress}>
      <Text style={styles.opcionTexto}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backText: { fontSize: 15, color: COLORS.accent, fontWeight: "700", width: 80 },
  headerTitle: { fontSize: 15, fontWeight: "700", color: COLORS.primary, flex: 1, textAlign: "center" },
  content: { padding: 24, paddingBottom: 48 },
  headerWrap: { marginBottom: 20 },
  badge: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: COLORS.accent, letterSpacing: 1.5 },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.primary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, lineHeight: 22 },
  seccion: { fontSize: 13, fontWeight: "800", color: COLORS.textMuted, letterSpacing: 1, marginBottom: 12, marginTop: 4, textTransform: "uppercase" },
  emptyWrap: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: COLORS.primary, textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 16 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardRecomendada: { borderWidth: 2, borderColor: COLORS.success },
  recoBadge: { backgroundColor: COLORS.success, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10, alignSelf: "flex-start", marginBottom: 12 },
  recoBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  cardTitleWrap: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: "900", color: COLORS.primary, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: COLORS.textMuted },
  cardNota: { fontSize: 12, color: COLORS.accent, fontWeight: "700", marginTop: 6 },
  approvedDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.success, marginTop: 4 },
  cardStats: { flexDirection: "row", backgroundColor: COLORS.background, borderRadius: 12, padding: 14, marginBottom: 16 },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: "#E2E8F0" },
  statLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600", marginBottom: 4 },
  statValue: { fontSize: 14, color: COLORS.primary, fontWeight: "800" },
  offerBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  offerBtnSec: { backgroundColor: COLORS.accentSoft, shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: COLORS.accentBorder },
  offerBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "900" },
  offerBtnTextSec: { color: COLORS.accent },
  linkBtn: { paddingVertical: 14, alignItems: "center" },
  linkBtnText: { color: COLORS.accent, fontSize: 15, fontWeight: "700" },
  fase: { paddingTop: 8 },
  faseTitulo: { fontSize: 22, fontWeight: "900", color: COLORS.primary, marginBottom: 8 },
  faseTexto: { fontSize: 15, color: COLORS.textMuted, lineHeight: 22, marginBottom: 18 },
  requisitosCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, marginBottom: 14, gap: 12 },
  requisitoRow: { flexDirection: "row", alignItems: "flex-start" },
  requisitoCheck: { fontSize: 16, color: COLORS.success, fontWeight: "900", marginRight: 10 },
  requisitoTexto: { fontSize: 15, color: COLORS.text, fontWeight: "600", flex: 1 },
  tip: { fontSize: 13, color: COLORS.textMuted, lineHeight: 20, marginBottom: 20 },
  opcion: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  opcionTexto: { fontSize: 16, fontWeight: "700", color: COLORS.primary },
  bannerWrap: { alignItems: "center", marginVertical: 20 },
  button: { backgroundColor: COLORS.accent, paddingVertical: 16, borderRadius: 14, alignItems: "center", width: "100%" },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: "900" },
  disclaimer: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  disclaimerText: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18, textAlign: "center" },
  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
  modalCaja: { backgroundColor: COLORS.white, borderRadius: 20, padding: 22 },
  modalTitulo: { fontSize: 20, fontWeight: "900", color: COLORS.primary, marginBottom: 8 },
  modalTexto: { fontSize: 15, color: COLORS.textMuted, lineHeight: 22, marginBottom: 14 },
  checkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  checkBox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.accentBorder, alignItems: "center", justifyContent: "center", marginRight: 12 },
  checkBoxOn: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  checkMark: { color: COLORS.white, fontWeight: "900", fontSize: 14 },
  checkText: { fontSize: 15, color: COLORS.text, fontWeight: "600", flex: 1 },
});
