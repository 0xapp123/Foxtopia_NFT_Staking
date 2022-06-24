import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { claimReward, withdrawNft } from "../contexts/transaction";
import StakedCard from "./StakedCard";
import { errorAlert } from "./toastGroup";
import { Button } from "./Widget"

export default function StakedCollectionBox(props: {
    title?: string,
    nfts?: any,
    onStake?: Function,
    onUnstake?: Function,
    onClaim?: Function,
    startLoading: Function,
    closeLoading: Function,
    updatePage: Function,
    forceRender: boolean,
    handleClaimReward: Function,
}) {
    const wallet = useWallet();
    const { startLoading, closeLoading, updatePage } = props
    const [selectedNfts, setSelectedNfts] = useState(props.nfts);

    const handleSelect = (nftMintAddress: string, selected: boolean) => {
        if (props.nfts && props.nfts.length !== 0) {
            let list: any = selectedNfts;
            if (list && list.length !== 0) {
                for (let i = 0; i < list.length; i++) {
                    if (list[i].mint === nftMintAddress) {
                        list[i].selected = selected;
                    }
                }
            }
            setSelectedNfts(list);
        }
    }

    const handleUnStake = async () => {
        if (wallet.publicKey === null) return;
        let nfts: any = [];
        for (let item of selectedNfts) {
            if (item.staked) {
                nfts.push(item);
            }
        }
        if (nfts.length === 0) {
            errorAlert("Please select NFT!")
            return;
        }
        console.log(nfts, "===> nfts")
        try {
            await withdrawNft(wallet, nfts, () => startLoading(), () => closeLoading(), () => updatePage())
        } catch (error) {
            console.log(error)
        }
    }

    const handleClaimReward = async () => {
        try {
            await claimReward(wallet, () => props.startLoading(), () => props.closeLoading(), () => props.updatePage());
        } catch (error) {
            console.log(error)
        }
    }

    useEffect(() => {
        setSelectedNfts(props.nfts);
        // eslint-disable-next-line
    }, [props.nfts])

    return (
        <div className="collection-box staked-collectionbox">
            <div className="box-body">
                <div className="box-header">
                    <div className="box-title"><div className="content">STAKED NFT</div></div>
                    <div className="button-group">
                        <Button variant="secondary" onClick={handleUnStake}>
                            UNSTAKE ALL
                        </Button>
                        <Button onClick={handleClaimReward} variant="secondary">
                            CLAIM ALL
                        </Button>
                    </div>
                </div>
                <div className="box-content">
                    {props.nfts && props.nfts.length !== 0 && props.nfts.map((item: any, key: number) => (
                        item.staked &&
                        <StakedCard
                            mint={item.mint}
                            staked={item.staked}
                            selected={item.selected}
                            stakedTime={item.stakedTime}
                            key={key}
                            handleSelect={handleSelect}
                            forceRender={props.forceRender}
                            wallet={wallet}
                            startLoading={() => props.startLoading()}
                            closeLoading={() => props.closeLoading()}
                            updatePage={() => props.updatePage()}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}