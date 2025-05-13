type MyButtonProps = {
  text: string;
};

const MyButton = ({ text }: MyButtonProps) => {
  return <button>{text}</button>;
};

export default MyButton;
