'use client'
import { useEffect, useState } from "react";
import {
  AbsoluteCenter,
  Box,
  VStack,
  Image,
  Button,
  Heading,
  SimpleGrid,
  Text,
  Input,
  HStack,
  Spinner,
} from "@chakra-ui/react";
import { db } from "./firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { toaster } from "@/components/ui/toaster";

export default function Home() {
  // --- Estados do Jogo ---
  const [jogadores, setJogadores] = useState([]);
  const [opcoes, setOpcoes] = useState([]);
  const [donoImagem, setDonoImagem] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [resposta, setResposta] = useState(null);
  const [erroJogo, setErroJogo] = useState(null);

  // --- Estados do Usuário e Login ---
  const [cpfInput, setCpfInput] = useState("");
  const [authenticating, setAuthenticating] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // --- Estados de Tentativas e Fim de Jogo ---
  const [tentativas, setTentativas] = useState(0);
  const [fimDeJogo, setFimDeJogo] = useState(false);
  const [bonus, setBonus] = useState(false);
  const [usandoBonus, setUsandoBonus] = useState(false);
  const [jogadoresJaSorteados, setJogadoresJaSorteados] = useState([]);
  const [primeiraPontuacao, setPrimeiraPontuacao] = useState(null);
  const [maxTentativas, setMaxTentativas] = useState(20); 

  // useEffect para salvar a pontuação máxima
  useEffect(() => {
    if (fimDeJogo && currentUser) {
      const salvarPontuacaoFinal = async () => {
        const pontuacaoFinal = primeiraPontuacao !== null
          ? Math.max(primeiraPontuacao, currentUser.score)
          : currentUser.score;

        const userRef = doc(db, "cadastros", currentUser.id);

        try {
          await updateDoc(userRef, {
            score: pontuacaoFinal,
          });
          console.log("Pontuação final salva no banco de dados:", pontuacaoFinal);
        } catch (error) {
          console.error("Erro ao salvar a pontuação final no banco:", error);
          toaster.create({ title: "Erro", description: "Não foi possível salvar sua pontuação final.", type: "error" });
        }
      };

      salvarPontuacaoFinal();
    }
  }, [fimDeJogo, currentUser, primeiraPontuacao]);

  // --- Funções Utilitárias ---
  const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);
  const cleanCpf = (cpf) => (cpf || "").replace(/\D/g, "");

  // --- Lógica Principal do Jogo ---

  const carregarJogadores = async (empresaDoUsuario, idDoUsuario) => {
    setCarregando(true);
    try {
      const q = query(
        collection(db, "cadastros"),
        where("empresa", "==", empresaDoUsuario)
      );
      const querySnapshot = await getDocs(q);

      const lista = querySnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((jogador) => jogador.imageUrl && jogador.genero)
        .filter((jogador) => jogador.id !== idDoUsuario);

      const homens = lista.filter(j => j.genero === 'm');
      const mulheres = lista.filter(j => j.genero === 'f');

      if (lista.length < 4) {
          setErroJogo(`Não há jogadores suficientes na empresa '${empresaDoUsuario}' para iniciar. (Mínimo: 4)`);
      } else if (homens.length < 2 || mulheres.length < 2) {
          setErroJogo(`É necessário ter pelo menos 2 homens e 2 mulheres com foto na empresa '${empresaDoUsuario}' para jogar.`);
      } else {
        setErroJogo(null);
        setJogadores(lista);
      }
    } catch (error) {
      console.error("Erro ao carregar jogadores da empresa:", error);
      setErroJogo("Ocorreu um erro ao carregar os dados do jogo.");
    } finally {
      setCarregando(false);
    }
  };

  const maskCPF = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .substring(0, 14);
  };

  const gerarRodada = () => {
  if (jogadores.length < 4) return;

  // NOVO: Filtrar todos os jogadores que ainda não foram usados em nenhuma rodada
  const jogadoresDisponiveis = jogadores.filter(j => !jogadoresJaSorteados.includes(j.id));

  // NOVO: Verificar se ainda há jogadores suficientes para montar uma rodada
  if (jogadoresDisponiveis.length < 4) {
    setErroJogo("Não há mais jogadores únicos suficientes para gerar novas rodadas.");
    setFimDeJogo(true);
    return;
  }

  const homensDisponiveis = jogadoresDisponiveis.filter(j => j.genero === 'm');
  const mulheresDisponiveis = jogadoresDisponiveis.filter(j => j.genero === 'f');

  if (homensDisponiveis.length < 1 || mulheresDisponiveis.length < 1) {
    setErroJogo("Não há mais combinações de gênero possíveis para continuar.");
    setFimDeJogo(true);
    return;
  }

  let escolhido;
  let homensSorteados = [];
  let mulheresSorteadas = [];

  const generoEscolhido = Math.random() > 0.5 ? 'm' : 'f';

  if (generoEscolhido === 'm' && homensDisponiveis.length > 0) {
    escolhido = shuffle(homensDisponiveis)[0];
    homensSorteados = shuffle(homensDisponiveis.filter(j => j.id !== escolhido.id)).slice(0, 1);
    mulheresSorteadas = shuffle(mulheresDisponiveis).slice(0, 2);
    homensSorteados.push(escolhido);
  } else {
    escolhido = shuffle(mulheresDisponiveis)[0];
    mulheresSorteadas = shuffle(mulheresDisponiveis.filter(j => j.id !== escolhido.id)).slice(0, 1);
    homensSorteados = shuffle(homensDisponiveis).slice(0, 2);
    mulheresSorteadas.push(escolhido);
  }

  const sorteados = shuffle([...homensSorteados, ...mulheresSorteadas]);

  // NOVO: Registrar todos os jogadores usados nesta rodada
  const idsUsados = [...sorteados.map(j => j.id), escolhido.id];
  setJogadoresJaSorteados(prev => [...new Set([...prev, ...idsUsados])]);

  setOpcoes(sorteados);
  setDonoImagem(escolhido);
  setResposta(null);
};

  useEffect(() => {
    if (jogadores.length > 0) gerarRodada();
  }, [jogadores]);

  const handleLoginByCpf = async (e) => {
    e?.preventDefault();
    if (authenticating) return;
    setAuthenticating(true);

    const cpfLimpo = cleanCpf(cpfInput);
    if (!cpfLimpo) {
      toaster.create({ title: "CPF inválido", type: "warning" });
      setAuthenticating(false);
      return;
    }

    try {
      const q = query(collection(db, "cadastros"), where("cpf", "==", cpfLimpo));
      const qs = await getDocs(q);

      if (qs.empty) {
        toaster.create({ title: "CPF não encontrado", type: "error" });
        setAuthenticating(false);
        return;
      }

      const userDoc = qs.docs[0];
      const userData = { id: userDoc.id, ...userDoc.data() };

      if (userData.empresa === 'GC') {
        setMaxTentativas(7);
      } else {
        setMaxTentativas(20);
      }

      userData.score = userData.score ?? 0;
      userData.tentativasJogadas = userData.tentativasJogadas ?? 0;
      userData.possuiBonus = userData.possuiBonus ?? false;
      setBonus(userData.possuiBonus);
      setCurrentUser(userData);
      
      const limiteDeTentativas = userData.empresa === 'GC' ? 7 : 20;
      if (userData.tentativasJogadas >= limiteDeTentativas) {
        setFimDeJogo(true);
        setAuthenticating(false);
        return;
      }

      setJogadoresJaSorteados([]);
      setPrimeiraPontuacao(null);
      setTentativas(userData.tentativasJogadas);
      setFimDeJogo(false);
      await carregarJogadores(userData.empresa, userData.id);

      toaster.create({
        title: "Bem-vindo!",
        description: `Olá, ${userData.nomeCompleto}. Boa sorte!`,
        type: "success",
      });
    } catch (error) {
      console.error("Erro ao logar por CPF:", error);
      toaster.create({ title: "Erro ao buscar CPF", type: "error" });
    } finally {
      setAuthenticating(false);
    }
  };

  // #############################################################
  // ##            A ÚNICA MUDANÇA ESTÁ NESTA FUNÇÃO            ##
  // #############################################################
  const handleJogarNovamenteComBonus = async () => {
    if (usandoBonus) return;
    setUsandoBonus(true);

    // NOVO: Validação para garantir que há jogadores únicos suficientes para a 2ª rodada
    const jogadoresDisponiveis = jogadores.filter(j => !jogadoresJaSorteados.includes(j.id));
    const homensDisponiveis = jogadoresDisponiveis.filter(j => j.genero === 'm');
    const mulheresDisponiveis = jogadoresDisponiveis.filter(j => j.genero === 'f');

    if (homensDisponiveis.length < 2 || mulheresDisponiveis.length < 2) {
        toaster.create({ 
            title: "Ops!", 
            description: "Não há jogadores únicos suficientes para uma segunda rodada.", 
            type: "error" 
        });
        setUsandoBonus(false);
        return; // Impede o início da segunda rodada
    }
    // FIM DA VALIDAÇÃO

    setPrimeiraPontuacao(currentUser.score);

    try {
      const userRef = doc(db, "cadastros", currentUser.id);
      await updateDoc(userRef, {
        score: 0,
        tentativasJogadas: 0,
        possuiBonus: false,
      });

      // REMOVIDO: A condição que resetava a lista foi removida.
      // A lista de 'jogadoresJaSorteados' agora SEMPRE persiste na segunda rodada.
      
      setTentativas(0);
      setFimDeJogo(false);
      setBonus(false);
      setCurrentUser((prev) => ({
        ...prev,
        score: 0,
        tentativasJogadas: 0,
        possuiBonus: false
      }));

      toaster.create({ title: "Segunda chance!", description: "Sua pontuação foi salva. Boa sorte!", type: "success" });
      gerarRodada();
    } catch (err) {
      console.error("Erro ao usar o bônus:", err);
      toaster.create({ title: "Erro", description: "Não foi possível usar o bônus.", type: "error" });
    } finally {
      setUsandoBonus(false);
    }
  };

  const verificarResposta = async (id) => {
    if (resposta || fimDeJogo) return;
    if (!currentUser) return;

    const acertou = id === donoImagem.id;
    setResposta(acertou ? "acerto" : "erro");
    toaster.create({ title: acertou ? "🎉 Acertou!" : "❌ Errou!", type: acertou ? "success" : "error", duration: 1500 });

    const novaPontuacao = acertou ? (currentUser.score ?? 0) + 1 : (currentUser.score ?? 0);
    const novaTentativa = tentativas + 1;

    try {
      const userRef = doc(db, "cadastros", currentUser.id);
      await updateDoc(userRef, { score: novaPontuacao, tentativasJogadas: novaTentativa });
      setCurrentUser((prev) => ({ ...prev, score: novaPontuacao, tentativasJogadas: novaTentativa }));
      setTentativas(novaTentativa);
    } catch (err) {
      console.error("Erro ao atualizar dados:", err);
    }

    if (novaTentativa >= maxTentativas) {
      setFimDeJogo(true);
    } else {
      setTimeout(() => gerarRodada(), 1500);
    }
  };

  // --- Renderização ---
  if (carregando) {
    return ( <AbsoluteCenter><VStack><Spinner /><Heading>Carregando...</Heading></VStack></AbsoluteCenter> );
  }

  if (erroJogo) {
    return (
      <AbsoluteCenter textAlign="center" p={8}>
        <Heading size="md">Opa!</Heading>
        <Text mt={4}>{erroJogo}</Text>
      </AbsoluteCenter>
    )
  }

  if (!currentUser) {
    return (
      <AbsoluteCenter px={{ base: 4, md: 8 }} w="100%">
        <Box p={{ base: 4, md: 8 }} w={{ base: "100%", md: "520px" }} borderRadius="lg" shadow="lg">
          <VStack spacing={6}>
            <Heading size="lg">Entrar com CPF</Heading>
            <Text textAlign="center">Informe o CPF cadastrado para jogar.</Text>
            <form style={{ width: "100%" }} onSubmit={handleLoginByCpf}>
              <VStack spacing={4}>
                <Input placeholder="000.000.000-00" value={cpfInput} onChange={(e) => setCpfInput(maskCPF(e.target.value))} />
                <Button type="submit" colorScheme="blue" isLoading={authenticating} loadingText="Verificando..." w="100%">Entrar</Button>
              </VStack>
            </form>
          </VStack>
        </Box>
      </AbsoluteCenter>
    );
  }

  if (fimDeJogo) {
    const pontuacaoFinal = primeiraPontuacao !== null
      ? Math.max(primeiraPontuacao, currentUser.score)
      : currentUser.score;

    return (
      <AbsoluteCenter px={{ base: 4, md: 8 }} w={"100%"}>
        <Box p={{ base: 4, md: 8 }} w={{ base: "100%", md: "520px" }} borderRadius="lg" shadow="lg" textAlign="center">
          <VStack spacing={6}>
            <Heading size="xl">Fim de Jogo!</Heading>
            <Text fontSize="lg" mt={4}>Sua melhor pontuação foi:</Text>
            <Heading size="3xl" color="blue.500">{pontuacaoFinal}</Heading>
            {primeiraPontuacao !== null && (
              <Text fontSize="md" color="gray.500">
                (1ª Rodada: {primeiraPontuacao} | 2ª Rodada: {currentUser.score})
              </Text>
            )}

            {bonus ? (
              <>
                <Text fontSize="md" color="gray.600" pt={4}>Você cadastrou uma foto e ganhou uma chance extra!</Text>
                <Button onClick={handleJogarNovamenteComBonus} isLoading={usandoBonus} loadingText="Aguarde..." size={"lg"} colorScheme="blue" width={"100%"}>
                  Jogar novamente
                </Button>
              </>
            ) : (
              <Text fontSize="md" color="gray.600" pt={4}>Obrigado por jogar!</Text>
            )}
          </VStack>
        </Box>
      </AbsoluteCenter>
    );
  }

  return (
    <AbsoluteCenter px={{ base: 4, md: 8 }} w={"100%"}>
      <Box p={{ base: 0, md: 8 }} w={{ base: "100%", md: "720px" }}>
        <VStack spacing={6} align="stretch">
          <HStack justify="space-between" align="center">
            <Heading size="lg"></Heading>
            <Box textAlign="right">
              <Text fontSize="sm">Jogador</Text>
              <Text fontWeight="bold">{currentUser.nomeCompleto}</Text>
              <Text fontSize="sm">Pontuação: {currentUser.score ?? 0}</Text>
              <Text fontSize="sm" color="gray.500">Rodada: {tentativas + 1}/{maxTentativas}</Text>
            </Box>
          </HStack>
          <VStack spacing={4} align="center">
            <Heading size="3xl" mb={10}>QUEM SOU EU?</Heading>
            <Box
              boxSize={{ base: "260px", md: "320px" }}
              borderRadius="xl"
              shadow="lg"
              overflow="hidden"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="gray.100"
            >
              <Image
                src={donoImagem?.imageUrl}
                alt="Foto misteriosa"
                objectFit="contain"
                maxW="100%"
                maxH="100%"
              />
            </Box>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} w="100%">
              {opcoes.map((item) => (
                <Button textTransform={"uppercase"} key={item.id} variant="outline" size="lg" w="100%" onClick={() => verificarResposta(item.id)} isDisabled={!!resposta}
                  colorScheme={ resposta && item.id === donoImagem.id ? "green" : resposta && item.id !== donoImagem.id ? "red" : "blue" }>
                  {item.nomeCompleto}
                </Button>
              ))}
            </SimpleGrid>
            {resposta && (
              <Text fontSize="xl" color={resposta === "acerto" ? "green.400" : "red.400"}>
                {resposta === "acerto" ? "✅ Você acertou!" : "❌ Você errou!"}
              </Text>
            )}
          </VStack>
        </VStack>
      </Box>
    </AbsoluteCenter>
  );
}