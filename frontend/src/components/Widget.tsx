import { styled } from "@mui/material/styles";
import Tooltip, { TooltipProps, tooltipClasses } from "@mui/material/Tooltip";
import Fade from "@mui/material/Fade";

export function TotalBanner(props: {
    supply: number,
    totalStaked: number,
    rewardsDistribued: number
}) {
    return (
        <div className="total-banner">
            <div className="gradient-border item">
                <div className="item-content">
                    <label>Supply</label>
                    <p>{props.supply}</p>
                </div>
            </div>
            <div className="gradient-border item">
                <div className="item-content">
                    <label>Total Staked</label>
                    <p>{(props.totalStaked / 75).toFixed(3)}%</p>
                </div>
            </div>
            <div className="gradient-border item">
                <div className="item-content">
                    <label>Rewards Distributed</label>
                    <p>{props.rewardsDistribued.toFixed(0)} $Foxie</p>
                </div>
            </div>
        </div>
    )
}

export function CurrentReward(props: {
    liveRewards: number,
    accumlatedRewards: number,
    handleAllReward: Function
}) {
    return (
        <div className="current-reward">
            <h3>Your current rewards</h3>
            <div className="content">
                <div className="item with-button">
                    <div className="item-content">
                        <div className="text-content">
                            <label>Live Rewards</label>
                            <p>+{props.liveRewards.toFixed(0)} $Foxie</p>
                        </div>
                        <button className="btn-claim-all claim-all" onClick={() => props.handleAllReward()}>
                            <div className="content">
                                Claim all rewards
                            </div>
                        </button>
                    </div>
                </div>
                <div className="item">
                    <div className="item-content">
                        <label>Accumulated Rewards</label>
                        <p>{props.accumlatedRewards.toLocaleString()} $Foxie</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export const Button = (props: {
    title?: string,
    children: any,
    style?: any,
    className?: string,
    onClick: Function,
    variant?: "primary" | "secondary",
}) => {
    return (
        <button
            className={`${props.variant === "primary" && "btn-primary"} ${props.variant === "secondary" && "btn-secondary"} ${props.className}`}
            style={props.style}
            onClick={() => props.onClick()}
        >
            <div className="content">
                {props.children}
            </div>
        </button >
    )
}

export const Copyright = () => {
    return (
        <footer className="container">
            <div className="copyright">
                <p>copyright © 2022  www.foxtopia.io</p>
            </div>
        </footer>
    )
}


export const LightTooltip = styled(({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} TransitionComponent={Fade} followCursor />
))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
        background: "linear-gradient(80deg, #004af9 0%, #db00ff 100%)",
        color: '#fff',
        boxShadow: "#333",
        fontSize: 12,
    },
}));