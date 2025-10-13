'use client'
import {
  AbsoluteCenter,
  Heading
} from "@chakra-ui/react";


export default function Home() {


    return (
      <AbsoluteCenter px={{ base: 4, md: 8 }} w="100%">
        <Heading textAlign={"center"}>Desafio encerrado! <br />Aguarde os resultados</Heading>
    </AbsoluteCenter>
  );
}