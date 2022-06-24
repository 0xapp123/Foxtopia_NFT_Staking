import { getParsedNftAccountsByOwner } from "@nfteyez/sol-rayz";
import { useWallet } from "@solana/wallet-adapter-react";
import { NextSeo } from "next-seo";
import { useEffect, useState } from "react";
import { foxtopiaData, foxtopiaGenesisData } from "../../RarityMonData";
import CollectionBox from "../components/CollectionBox";
import HakuCollectionBox from "../components/HakuCollectionBox";
import Header from "../components/Header";
import StakedCollectionBox from "../components/StakedCollectionBox";
import { Copyright, CurrentReward, TotalBanner } from "../components/Widget";
import { FOXIE_TOKEN_DECIMAL, FOXTOPIA_CREATOR_ADDRESS, FOXTOPIA_GENESIS_CREATOR_ADDRESS, LIVE_URL } from "../config";
import { calculateAllReward, claimReward, getAllNFTs, getGlobalInfo, getGlobalState } from "../contexts/transaction";
import { solConnection } from "../contexts/utils";
// import * as foxtopiaData from "../../foxtopia-data-final.json";
// import * as foxtopiaGenesisData from "../../foxtopiagenesis-data-final.json";

export default function HomePage(props: { startLoading: Function, closeLoading: Function }) {
  const { startLoading, closeLoading } = props;
  const wallet = useWallet()
  const [hide, setHide] = useState(false);
  const [foxList, setFoxList] = useState<any>();
  const [foxGenesisList, setFoxGenesisList] = useState<any>();
  const [forceRender, setForceRender] = useState(false);
  const [totalStaked, setTotalStaked] = useState(0);
  const [liveRewards, setLiveReward] = useState(0);
  const [totalRewardDistributed, setTotalRewardDistributed] = useState(0);
  const [accumulatedReward, setAccumulatedReward] = useState(0);
  const [allNfts, setAllNfts] = useState<any>([]);

  const getNFTs = async () => {
    startLoading(true);
    if (wallet.publicKey !== null) {
      try {
        const nftsList = await getParsedNftAccountsByOwner({ publicAddress: wallet.publicKey.toBase58(), connection: solConnection });
        let foxNfts: any = [];
        let foxGenesisNfts: any = [];
        let nfts: any = [];
        try {
          nfts = await getAllNFTs();
        } catch (error) {
          console.log(error)
        }
        let staked: any = [];
        for (let i = 0; i < nfts.count; i++) {
          if (nfts.data[i].owner === wallet.publicKey.toBase58()) {
            if (nfts.data[i].stakedCount !== 0) {
              for (let j = 0; j < nfts.data[i].stakedCount; j++) {
                staked.push({
                  mint: nfts.data[i].staking[j].mint,
                  stakedTime: nfts.data[i].staking[j].stakedTime
                }
                )
              }
            }
          }
        }
        for (let nft of nftsList) {
          if (nft.data.creators && nft.data.creators[0].address === FOXTOPIA_GENESIS_CREATOR_ADDRESS) {
            let stakedCheck = false;
            let stakedTime = new Date().getTime() / 1000;
            let rank = 6900;
            const result = foxtopiaData.find(({ title }) => title === nft.data.name);
            if (result) {
              rank = result.rank
            }
            for (let item of staked) {
              if (item.mint === nft.mint) {
                stakedCheck = true;
                stakedTime = item.stakedTime;
              }
            }
            foxGenesisNfts.push(
              {
                ...nft,
                staked: stakedCheck,
                selected: false,
                rank: rank,
                stakedTime: stakedTime
              }
            )
          } else if (nft.data.creators && nft.data.creators[0].address === FOXTOPIA_CREATOR_ADDRESS) {
            let stakedCheck = false;
            let stakedTime = new Date().getTime() / 1000;
            let rank = 600;
            const result = foxtopiaGenesisData.find(({ title }) => title === nft.data.name);
            if (result) {
              rank = result.rank
            }

            for (let item of staked) {
              if (item.mint === nft.mint) {
                stakedCheck = true;
                stakedTime = item.stakedTime;
              }
            }
            foxNfts.push(
              {
                ...nft,
                staked: stakedCheck,
                selected: false,
                rank: rank,
                stakedTime: stakedTime
              }
            )
          }
        }
        let foxGList: any = [];
        let foxList: any = [];
        let allFox: any = [];
        if (foxGenesisNfts.length !== 0) {
          let unstaked: any = [];
          let staked: any = [];
          for (let item of foxGenesisNfts) {
            if (item.staked) staked.push(item);
            if (!item.staked) unstaked.push(item);
          }
          foxGList = unstaked.concat(staked);
          setFoxGenesisList(foxGList);
        }
        if (foxNfts.length !== 0) {
          let unstaked: any = [];
          let staked: any = [];
          for (let item of foxNfts) {
            if (item.staked) staked.push(item);
            if (!item.staked) unstaked.push(item);
          }
          foxList = unstaked.concat(staked);
          setFoxList(foxList);
        }

        if (foxGList.length !== 0) {
          for (let item of foxGList) {
            allFox.push(item)
          }
          if (foxList.length !== 0) {
            for (let item of foxList) {
              allFox.push(item)
            }
          }
        }
        allFox.sort((a: any, b: any) => b.stakedTime - a.stakedTime);
        setAllNfts(allFox);
        setHide(!hide);
        closeLoading(false);
      } catch (error) {
        console.log(error);
        closeLoading(false);
      }
    }
  };

  const updatePage = async (nfts: any, setNfts: Function) => {
    // router.reload();
    setAllNfts([]);
    setFoxList([]);
    setFoxGenesisList([]);
    await getNFTs();
    // if (nfts && nfts.length !== 0) {
    //   for (let i = 0; i < nfts.length; i++) {
    //     nfts[i].selected = false;
    //   }
    // }
    // setNfts(nfts);
    setForceRender(!forceRender);
  }

  const getGlobalData = async () => {
    if (wallet.publicKey === null) return;
    const data = await getGlobalInfo();
    const global = await getGlobalState();
    const reward = await calculateAllReward(wallet.publicKey);
    const userData = await getAllNFTs();

    if (userData.count !== 0 && userData.data) {
      for (let item of userData.data) {
        if (item.owner === wallet.publicKey.toBase58()) {
          setAccumulatedReward(item.accumulatedReward / FOXIE_TOKEN_DECIMAL);
        }
      }
    }
    if (reward && data && global && userData.data?.length !== 0) {
      setTotalStaked(data.totalStakedCount);
      setLiveReward(reward / FOXIE_TOKEN_DECIMAL);
      setTotalRewardDistributed(global.totalRewardDistributed.toNumber() / FOXIE_TOKEN_DECIMAL)
    }
    setInterval(
      async () => {
        if (wallet.publicKey === null) return;
        const data = await getGlobalInfo();
        const global = await getGlobalState();
        const reward = await calculateAllReward(wallet.publicKey);
        const userData = await getAllNFTs();
        // console.log(userData, "userDATASS")
        if (userData.count !== 0 && userData.data) {
          for (let item of userData.data) {
            if (item.owner === wallet.publicKey.toBase58()) {
              setAccumulatedReward(item.accumulatedReward / FOXIE_TOKEN_DECIMAL);
            }
          }
        }
        if (reward && data && global && userData.data?.length !== 0) {
          setTotalStaked(data.totalStakedCount);
          setLiveReward(reward / FOXIE_TOKEN_DECIMAL);
          setTotalRewardDistributed(global.totalRewardDistributed.toNumber() / FOXIE_TOKEN_DECIMAL)
        }
      }
      , 10000);

    // const data = await getGlobalInfo();
    // const reward = await calculateAllReward(wallet.publicKey);
    // if (reward && data) {
    //   setTotalStaked(data.totalStakedCount)
    //   setLiveReward(reward / FOXIE_TOKEN_DECIMAL)
    // }
    // console.log(reward / FOXIE_TOKEN_DECIMAL, "====> reward");
  }

  const handleClaimReward = async () => {
    await claimReward(wallet, () => startLoading(), () => closeLoading(), () => getGlobalData());
  }


  useEffect(() => {
    if (wallet.publicKey !== null) {
      getNFTs();
      getGlobalData();
    } else {
      setAllNfts([]);
      setFoxList([]);
      setFoxGenesisList([]);
    }
    // eslint-disable-next-line
  }, [wallet.connected, wallet.publicKey]);

  return (
    <>
      <NextSeo
        title="Foxtopia | NFT Staking"
        description="Earn $Foxie when you stake with us! Be part of our Foxtopia community and earn rewards to use both in & out of game"
        openGraph={{
          url: `${LIVE_URL}`,
          title: 'Foxtopia | NFT Staking',
          description: 'Earn $Foxie when you stake with us! Be part of our Foxtopia community and earn rewards to use both in & out of game',
          images: [
            {
              url: `${LIVE_URL}og-cover.jpg`,
              width: 947,
              height: 540,
              alt: 'Foxtopia',
              type: 'image/jpeg',
            }
          ],
          site_name: 'Foxtopia',
        }}
      />
      <Header />
      <main>
        <div className="container">
          <TotalBanner
            supply={7500}
            totalStaked={totalStaked}
            rewardsDistribued={totalRewardDistributed}
          />
          <CurrentReward
            liveRewards={liveRewards}
            accumlatedRewards={accumulatedReward}
            handleAllReward={() => handleClaimReward()}
          />
          {/* Foxtopia Genesis Collection */}
          <CollectionBox
            title="Foxtopia Genesis Collection"
            nfts={foxGenesisList}
            startLoading={startLoading}
            closeLoading={closeLoading}
            updatePage={() => updatePage(foxGenesisList, setFoxGenesisList)}
            forceRender={forceRender}
            handleClaimReward={handleClaimReward}
          />
          {/* Foxtopia Collection */}
          <CollectionBox
            title="Foxtopia Collection"
            nfts={foxList}
            startLoading={startLoading}
            closeLoading={closeLoading}
            updatePage={() => updatePage(foxList, setFoxList)}
            forceRender={forceRender}
            handleClaimReward={handleClaimReward}
          />
          <HakuCollectionBox
            title="Haku"
          />
          {/* Foxtopia Collection */}
          <StakedCollectionBox
            nfts={allNfts}
            startLoading={startLoading}
            closeLoading={closeLoading}
            updatePage={() => updatePage(foxList, setFoxList)}
            forceRender={forceRender}
            handleClaimReward={handleClaimReward}
          />
        </div>
        <Copyright />
      </main>
    </>
  )
}