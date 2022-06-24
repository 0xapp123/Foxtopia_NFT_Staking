import { Skeleton } from "@mui/material";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import moment from "moment";
import { useEffect, useState } from "react";
import { calculateReward, claimReward, withdrawOneNft } from "../contexts/transaction";
import { getNftMetaData } from "../contexts/utils";
import { Button, LightTooltip } from "./Widget";

export default function StakedCard(props: {
    mint: string,
    staked: boolean,
    selected: boolean,
    handleSelect: Function,
    forceRender: boolean,
    stakedTime: number,
    wallet: WalletContextState,
    startLoading: Function,
    closeLoading: Function,
    updatePage: Function
}) {
    const [image, setImage] = useState("");
    const [nftIndex, setNftIndex] = useState("");
    const [selected, setSelected] = useState(false);
    const [reward, setReward] = useState(0);
    const getNFTdetail = async () => {
        const uri = await getNftMetaData(new PublicKey(props.mint))
        await fetch(uri)
            .then(resp =>
                resp.json()
            ).then((json) => {
                const str = json.name.split("#")
                setImage(json.image);
                setNftIndex(str[1]);
            })
            .catch((error) => {
                console.log(error)
            })
        const rewardChain = await calculateReward(props.wallet, new PublicKey(props.mint));
        setReward(rewardChain);
    }

    const handleUnstakeOne = async () => {
        try {
            await withdrawOneNft(props.wallet, props.mint, () => props.startLoading(), () => props.closeLoading(), () => props.updatePage())
        } catch (error) {
            console.log(error);
        }
    }

    const handleClaimReward = async () => {
        try {
            await claimReward(props.wallet, () => props.startLoading(), () => props.closeLoading(), () => props.updatePage(), new PublicKey(props.mint));
        } catch (error) {
            console.log(error)
        }
    }

    useEffect(() => {
        setSelected(props.selected);
        getNFTdetail();
        // eslint-disable-next-line
    }, [props.mint, props.forceRender, props.stakedTime])

    return (
        <div
            className={`nft-card ${selected && "selected"} staked`}
            style={{ minHeight: 280 }}
        >
            <div className="nft-card-content">
                <div className="media">
                    {image ?
                        // eslint-disable-next-line        
                        <img
                            src={image}
                            alt=""
                        />
                        :
                        <Skeleton variant="rectangular" width={139} height={158} sx={{ backgroundColor: "#fffefe15" }} style={{ borderRadius: 15 }} animation="wave" />
                    }
                    <div className="card-content">
                        <p className="staked-text">Staked: {moment(props.stakedTime * 1000).format("YYYY-MM-DD")}</p>
                        <p className="staked-text">12 $DRA</p>
                        <p className="staked-text">~{reward.toFixed(0)} $DRA</p>
                        <div className="staked-card-action">
                            <Button className="btn-third" onClick={handleUnstakeOne}>UNSTAKE</Button>
                            <Button className="btn-third" onClick={handleClaimReward}>CLAIM</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    )
}